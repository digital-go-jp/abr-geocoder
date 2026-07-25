package schema

import (
	"os"
	"strings"
	"testing"
)

// abrgRequiredColumns lists, per PostgreSQL table, the columns that abrg's
// cache build references in abrg/internal/cache/sql.go. That SQL hardcodes
// these names, so a table or column disappearing from the abrdb import config
// silently breaks `abrg cache build`. This is the abrdb half of the schema
// contract between the two modules; keep it in sync with abrg's cache SQL.
var abrgRequiredColumns = map[string][]string{
	"mt_pref_unified": {"lg_code", "pref", "rep_lon", "rep_lat"},
	"mt_city_unified": {"lg_code", "county", "city", "ward", "rep_lon", "rep_lat"},
	"mt_town_unified": {
		"lg_code", "machiaza_id", "rsdt_addr_flg", "oaza_cho", "chome",
		"koaza", "koaza_aka_code", "machiaza_dist", "wake_num_flg",
		"rep_lon", "rep_lat",
	},
	"mt_rsdtdsp_blk_unified": {"lg_code", "machiaza_id", "blk_id", "blk_num", "rep_lon", "rep_lat"},
	"mt_rsdtdsp_rsdt_unified": {
		"lg_code", "machiaza_id", "blk_id", "rsdt_id", "rsdt2_id",
		"rsdt_num", "rsdt_num2", "rep_lon", "rep_lat",
	},
	"mt_parcel_unified": {"lg_code", "machiaza_id", "prc_id", "prc_num1", "prc_num2", "prc_num3", "rep_lon", "rep_lat"},
}

// ddlColumnsByTable parses GenerateDDL output into a per-table set of column names.
func ddlColumnsByTable(t *testing.T, ddl string) map[string]map[string]bool {
	t.Helper()
	tables := make(map[string]map[string]bool)

	var current map[string]bool
	for line := range strings.Lines(ddl) {
		line = strings.TrimRight(line, "\n")
		if table, ok := strings.CutPrefix(line, "CREATE TABLE IF NOT EXISTS "); ok {
			name := strings.TrimSuffix(table, " (")
			current = make(map[string]bool)
			tables[name] = current
			continue
		}
		if line == ");" {
			current = nil
			continue
		}
		if current == nil || !strings.HasPrefix(line, "    ") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) == 0 {
			t.Fatalf("unexpected column line in DDL: %q", line)
		}
		current[fields[0]] = true
	}
	return tables
}

func assertDDLSatisfiesAbrgContract(t *testing.T, cfg *ImportConfig) {
	t.Helper()
	tables := ddlColumnsByTable(t, cfg.GenerateDDL())

	for table, columns := range abrgRequiredColumns {
		got, ok := tables[table]
		if !ok {
			t.Errorf("table %s required by abrg cache build is missing from DDL", table)
			continue
		}
		for _, col := range columns {
			if !got[col] {
				t.Errorf("table %s: column %s required by abrg cache build is missing from DDL", table, col)
			}
		}
	}
}

// TestGenerateDDL_SatisfiesAbrgContract verifies that the DDL generated from
// the embedded default import config defines every table and column that
// abrg's cache build SQL depends on.
func TestGenerateDDL_SatisfiesAbrgContract(t *testing.T) {
	cfg, err := ParseImportConfig(DefaultConfigYAML)
	if err != nil {
		t.Fatalf("ParseImportConfig(DefaultConfigYAML) error = %v", err)
	}
	assertDDLSatisfiesAbrgContract(t, cfg)
}

// TestGenerateDDL_FullConfigSatisfiesAbrgContract verifies the same contract
// for config_full.yaml, which can be installed via `abrdb init` with a custom
// config file.
func TestGenerateDDL_FullConfigSatisfiesAbrgContract(t *testing.T) {
	data, err := os.ReadFile("config_full.yaml")
	if err != nil {
		t.Fatalf("read config_full.yaml: %v", err)
	}
	cfg, err := ParseImportConfig(data)
	if err != nil {
		t.Fatalf("ParseImportConfig(config_full.yaml) error = %v", err)
	}
	assertDDLSatisfiesAbrgContract(t, cfg)
}

// TestGenerateDDL_ColumnParity pins that ddlColumnsByTable sees exactly the
// merged text+pos columns for each category, guarding the parser this
// contract test relies on.
func TestGenerateDDL_ColumnParity(t *testing.T) {
	cfg, err := ParseImportConfig(DefaultConfigYAML)
	if err != nil {
		t.Fatalf("ParseImportConfig(DefaultConfigYAML) error = %v", err)
	}
	tables := ddlColumnsByTable(t, cfg.GenerateDDL())

	for name, cat := range cfg.Category {
		got, ok := tables[cat.TableName]
		if !ok {
			t.Errorf("category %s: table %s missing from DDL", name, cat.TableName)
			continue
		}
		merged := cat.mergeColumns()
		if len(got) != len(merged) {
			t.Errorf("category %s: DDL has %d columns, config merges %d", name, len(got), len(merged))
		}
		for _, col := range merged {
			if !got[col.Name] {
				t.Errorf("category %s: column %s missing from DDL", name, col.Name)
			}
		}
	}
}
