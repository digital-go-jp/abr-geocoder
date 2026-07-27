// Package schema provides import configuration parsing from YAML files.
package schema

import (
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"

	"gopkg.in/yaml.v3"

	"abrdb/internal/model"
)

type ImportConfig struct {
	Version  int                        `yaml:"version"`
	Category map[string]*CategoryConfig `yaml:"category"`
}

type CategoryConfig struct {
	TableName   string        `yaml:"table_name"`
	S3TextPath  string        `yaml:"s3_text_path"`
	S3PosPath   string        `yaml:"s3_pos_path"`
	TextColumns []ColumnDef   `yaml:"text_columns"`
	PosColumns  []ColumnDef   `yaml:"pos_columns"`
	JoinColumns []string      `yaml:"join_columns"`
	Filters     *FilterConfig `yaml:"filters,omitempty"`
}

type ColumnDef struct {
	Name             string `yaml:"name"`
	Type             string `yaml:"type"`
	Nullable         bool   `yaml:"nullable"`          // default: false (NOT NULL)
	ConvertFullwidth bool   `yaml:"convert_fullwidth"` // default: false, apply full-width to half-width conversion
}

// FilterConfig maps column names to allowed values for IN clause filtering.
type FilterConfig map[string][]string

func ParseImportConfig(data []byte) (*ImportConfig, error) {
	var cfg ImportConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("validate config: %w", err)
	}

	return &cfg, nil
}

var validCategory = func() map[string]struct{} {
	m := make(map[string]struct{}, len(model.AllCategory))
	for _, cat := range model.AllCategory {
		m[string(cat)] = struct{}{}
	}
	return m
}()

func (c *ImportConfig) Validate() error {
	if c.Version != 1 {
		return fmt.Errorf("unsupported config version: %d (expected 1)", c.Version)
	}
	if len(c.Category) == 0 {
		return errors.New("no category defined")
	}

	for name, cat := range c.Category {
		if _, ok := validCategory[name]; !ok {
			return fmt.Errorf("unknown category: %s", name)
		}
		if cat.TableName == "" {
			return fmt.Errorf("category %s: table_name is required", name)
		}
		// Empty paths would become empty scan prefixes, silently matching no
		// files and reporting "no changes".
		if cat.S3TextPath == "" {
			return fmt.Errorf("category %s: s3_text_path is required", name)
		}
		if len(cat.PosColumns) > 0 && cat.S3PosPath == "" {
			return fmt.Errorf("category %s: s3_pos_path is required when pos_columns are defined", name)
		}
		if len(cat.TextColumns) == 0 {
			return fmt.Errorf("category %s: text_columns is required", name)
		}
		if len(cat.PosColumns) == 0 {
			return fmt.Errorf("category %s: pos_columns is required", name)
		}
		if len(cat.JoinColumns) == 0 {
			return fmt.Errorf("category %s: join_columns is required", name)
		}

		// Join columns drive the text/pos merge, so they must exist on both sides.
		textCols := columnNameSet(cat.TextColumns)
		posCols := columnNameSet(cat.PosColumns)
		for _, jc := range cat.JoinColumns {
			if _, ok := textCols[jc]; !ok {
				return fmt.Errorf("category %s: join column %q not in text_columns", name, jc)
			}
			if _, ok := posCols[jc]; !ok {
				return fmt.Errorf("category %s: join column %q not in pos_columns", name, jc)
			}
		}

		// Unknown PG types would silently degrade to VARCHAR in the DuckDB ETL.
		for _, col := range slices.Concat(cat.TextColumns, cat.PosColumns) {
			if col.Name == "" {
				return fmt.Errorf("category %s: column with empty name", name)
			}
			if !isKnownPGType(col.Type) {
				return fmt.Errorf("category %s: column %s has unsupported type %q", name, col.Name, col.Type)
			}
		}
	}
	return nil
}

func columnNameSet(columns []ColumnDef) map[string]struct{} {
	set := make(map[string]struct{}, len(columns))
	for _, col := range columns {
		set[col.Name] = struct{}{}
	}
	return set
}

// isKnownPGType mirrors the type coverage of pgTypeToDuckDB.
func isKnownPGType(pgType string) bool {
	if strings.HasPrefix(pgType, "CHAR") {
		return true
	}
	_, ok := pgTypeToDuckDBMap[pgType]
	return ok
}

func (c *ImportConfig) ToCategoryInfoMap() map[string]*CategoryInfo {
	result := make(map[string]*CategoryInfo, len(c.Category))
	for name, cat := range c.Category {
		result[name] = cat.toCategoryInfo()
	}
	return result
}

func (cat *CategoryConfig) toCategoryInfo() *CategoryInfo {
	textCols, textColTypes, fullwidthCols := extractColumnInfo(cat.TextColumns, true)
	posCols, posColTypes, _ := extractColumnInfo(cat.PosColumns, false)

	var filters FilterConfig
	if cat.Filters != nil {
		filters = *cat.Filters
	}

	return &CategoryInfo{
		TableName:        cat.TableName,
		S3TextPath:       cat.S3TextPath,
		S3PosPath:        cat.S3PosPath,
		TextColumns:      textCols,
		PosColumns:       posCols,
		JoinColumns:      cat.JoinColumns,
		OutputColumns:    dedupColumns(textCols, posCols),
		Filters:          filters,
		TextColumnTypes:  textColTypes,
		PosColumnTypes:   posColTypes,
		FullwidthColumns: fullwidthCols,
	}
}

// dedupColumns returns text columns followed by the pos-only columns, keeping
// first-seen order. This is the column order of both the transformed temp
// table and the PostgreSQL table DDL (see mergeColumns).
func dedupColumns(textCols, posCols []string) []string {
	seen := make(map[string]struct{}, len(textCols)+len(posCols))
	out := make([]string, 0, len(textCols)+len(posCols))
	for _, c := range slices.Concat(textCols, posCols) {
		if _, ok := seen[c]; ok {
			continue
		}
		seen[c] = struct{}{}
		out = append(out, c)
	}
	return out
}

func extractColumnInfo(columns []ColumnDef, trackFullwidth bool) ([]string, map[string]string, map[string]bool) {
	names := make([]string, len(columns))
	types := make(map[string]string, len(columns))
	var fullwidth map[string]bool
	if trackFullwidth {
		fullwidth = make(map[string]bool)
	}

	for i, col := range columns {
		names[i] = col.Name
		types[col.Name] = pgTypeToDuckDB(col.Type)
		if trackFullwidth && col.ConvertFullwidth {
			fullwidth[col.Name] = true
		}
	}
	return names, types, fullwidth
}

var pgTypeToDuckDBMap = map[string]string{
	"TEXT":             "VARCHAR",
	"SMALLINT":         "SMALLINT",
	"INTEGER":          "INTEGER",
	"DOUBLE PRECISION": "DOUBLE",
	"REAL":             "FLOAT",
	"DATE":             "DATE",
}

func pgTypeToDuckDB(pgType string) string {
	if strings.HasPrefix(pgType, "CHAR") {
		return "VARCHAR"
	}
	if t, ok := pgTypeToDuckDBMap[pgType]; ok {
		return t
	}
	return "VARCHAR"
}

// CategoryInfo holds all metadata for a category used by ETL processing.
type CategoryInfo struct {
	TableName        string
	S3TextPath       string
	S3PosPath        string
	TextColumns      []string
	PosColumns       []string
	JoinColumns      []string
	OutputColumns    []string // deduplicated text+pos columns: the single source for INSERT and transform SELECT column lists
	Filters          FilterConfig
	TextColumnTypes  map[string]string // column name -> DuckDB type for text CSV
	PosColumnTypes   map[string]string // column name -> DuckDB type for position CSV
	FullwidthColumns map[string]bool   // columns that need full-width to half-width conversion
}

// TableColumns returns, per table name, the column names the config defines
// (merged text+pos columns). This is the column set `abrdb init` creates for
// each table.
func (c *ImportConfig) TableColumns() map[string][]string {
	result := make(map[string][]string, len(c.Category))
	for _, cat := range c.Category {
		merged := cat.mergeColumns()
		names := make([]string, len(merged))
		for i, col := range merged {
			names[i] = col.Name
		}
		result[cat.TableName] = names
	}
	return result
}

func (c *ImportConfig) GenerateDDL() string {
	var sb strings.Builder
	names := slices.Sorted(maps.Keys(c.Category))

	for i, name := range names {
		cat := c.Category[name]
		if i > 0 {
			sb.WriteString("\n")
		}
		sb.WriteString(cat.GenerateDDL())
	}

	return sb.String()
}

func (cat *CategoryConfig) GenerateDDL() string {
	var sb strings.Builder

	fmt.Fprintf(&sb, "DROP TABLE IF EXISTS %s CASCADE;\n\n", cat.TableName)
	fmt.Fprintf(&sb, "CREATE TABLE IF NOT EXISTS %s (\n", cat.TableName)

	columns := cat.mergeColumns()
	for i, col := range columns {
		nullable := ""
		if !col.Nullable {
			nullable = " NOT NULL"
		}
		comma := ","
		if i == len(columns)-1 {
			comma = ""
		}
		fmt.Fprintf(&sb, "    %-18s %s%s%s\n", col.Name, col.Type, nullable, comma)
	}

	sb.WriteString(");\n")
	return sb.String()
}

func (cat *CategoryConfig) mergeColumns() []ColumnDef {
	seen := make(map[string]struct{})
	result := make([]ColumnDef, 0, len(cat.TextColumns)+len(cat.PosColumns))

	addUnique := func(col ColumnDef) {
		if _, exists := seen[col.Name]; exists {
			return
		}
		seen[col.Name] = struct{}{}
		result = append(result, col)
	}

	for _, col := range cat.TextColumns {
		addUnique(col)
	}
	for _, col := range cat.PosColumns {
		addUnique(col)
	}
	return result
}
