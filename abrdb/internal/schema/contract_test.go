package schema

import (
	"os"
	"regexp"
	"slices"
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

// abrgCacheSQLPath locates abrg's cache build SQL inside the repository
// checkout. The contract test requires it; a missing file is a failure, not a
// skip, because the whole point is keeping both modules in sync.
const abrgCacheSQLPath = "../../../abrg/internal/cache/sql.go"

var (
	// pgTableRefRe matches "FROM/JOIN pg.public.<table> <alias>".
	pgTableRefRe = regexp.MustCompile(`(?:FROM|JOIN)\s+pg\.public\.(mt_\w+)\s+(\w+)`)
	// qualifiedColRe matches "<alias>.<column>" references.
	qualifiedColRe = regexp.MustCompile(`\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\b`)
)

// sqlKeywords are tokens that can follow a table reference that has no alias.
var sqlKeywords = map[string]bool{
	"WHERE": true, "ON": true, "GROUP": true, "ORDER": true, "UNION": true,
	"INNER": true, "LEFT": true, "JOIN": true, "SELECT": true, "LIMIT": true,
}

// abrgCacheSQLColumns extracts, per pg.public.mt_* table, the alias-qualified
// column names referenced by abrg's cache build SQL. Unqualified references
// (single-table statements without an alias) are not attributed; every such
// statement in sql.go only repeats columns that are also alias-qualified
// elsewhere.
func abrgCacheSQLColumns(t *testing.T) map[string]map[string]bool {
	t.Helper()
	data, err := os.ReadFile(abrgCacheSQLPath)
	if err != nil {
		t.Fatalf("read abrg cache SQL (required for the schema contract): %v", err)
	}
	src := string(data)

	aliases := make(map[string]string)
	for _, m := range pgTableRefRe.FindAllStringSubmatch(src, -1) {
		table, alias := m[1], m[2]
		if sqlKeywords[alias] {
			continue
		}
		if prev, ok := aliases[alias]; ok && prev != table {
			t.Fatalf("alias %q maps to both %s and %s; per-statement parsing needed", alias, prev, table)
		}
		aliases[alias] = table
	}
	if len(aliases) == 0 {
		t.Fatal("no pg.public.mt_* table references found in abrg cache SQL")
	}

	columns := make(map[string]map[string]bool)
	for _, m := range qualifiedColRe.FindAllStringSubmatch(src, -1) {
		table, ok := aliases[m[1]]
		if !ok {
			continue
		}
		if columns[table] == nil {
			columns[table] = make(map[string]bool)
		}
		columns[table][m[2]] = true
	}
	return columns
}

// TestAbrgRequiredColumns_MatchesAbrgCacheSQL keeps abrgRequiredColumns in
// sync with abrg/internal/cache/sql.go in both directions: every listed
// table/column must be referenced by the SQL, and every table/column the SQL
// references must be listed.
func TestAbrgRequiredColumns_MatchesAbrgCacheSQL(t *testing.T) {
	sqlColumns := abrgCacheSQLColumns(t)

	for table, cols := range abrgRequiredColumns {
		referenced, ok := sqlColumns[table]
		if !ok {
			t.Errorf("table %s is listed but not referenced by abrg cache SQL", table)
			continue
		}
		for _, col := range cols {
			if !referenced[col] {
				t.Errorf("table %s: column %s is listed but not referenced by abrg cache SQL", table, col)
			}
		}
	}

	for table, referenced := range sqlColumns {
		listed := abrgRequiredColumns[table]
		if listed == nil {
			t.Errorf("table %s is referenced by abrg cache SQL but missing from abrgRequiredColumns", table)
			continue
		}
		for col := range referenced {
			if !slices.Contains(listed, col) {
				t.Errorf("table %s: column %s is referenced by abrg cache SQL but missing from abrgRequiredColumns", table, col)
			}
		}
	}
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
// every embedded import config profile defines each table and column that
// abrg's cache build SQL depends on. `abrdb import` resolves its config from
// these profiles, so this covers every config an import can actually run with.
func TestGenerateDDL_SatisfiesAbrgContract(t *testing.T) {
	for _, name := range ProfileNames() {
		t.Run(name, func(t *testing.T) {
			cfg, err := LoadProfile(name)
			if err != nil {
				t.Fatalf("LoadProfile(%q) error = %v", name, err)
			}
			assertDDLSatisfiesAbrgContract(t, cfg)
		})
	}
}

// TestGenerateDDL_ColumnParity pins that ddlColumnsByTable sees exactly the
// merged text+pos columns for each category, guarding the parser this
// contract test relies on.
func TestGenerateDDL_ColumnParity(t *testing.T) {
	cfg, err := ParseImportConfig(defaultConfigYAML)
	if err != nil {
		t.Fatalf("ParseImportConfig(defaultConfigYAML) error = %v", err)
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
