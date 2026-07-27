package duckdb

import (
	"fmt"
	"slices"
	"strings"
	"testing"

	"abrdb/internal/schema"
)

func TestBuildTransformSQL(t *testing.T) {
	tn := tableNames{Text: "txt", Pos: "pos", Transformed: "out"}

	tests := []struct {
		name   string
		info   *schema.CategoryInfo
		hasPos bool
		want   string
	}{
		{
			// Text-only load: position columns become NULL, no JOIN, join_seq is constant.
			name: "no position data, no join, no fullwidth",
			info: &schema.CategoryInfo{
				TextColumns: []string{"lg_code", "machiaza_id"},
				PosColumns:  []string{"rep_lat", "rep_lon"},
			},
			hasPos: false,
			want: "CREATE OR REPLACE TEMP TABLE out AS\n" +
				"SELECT lg_code as lg_code, machiaza_id as machiaza_id, NULL as rep_lat, NULL as rep_lon, 1 as join_seq\n" +
				"FROM txt\n",
		},
		{
			// Position data + join columns: base columns alias to t.*, a shared column
			// (chiban) is not re-emitted from pos, fullwidth chiban is translated, and the
			// dedup ROW_NUMBER with deterministic tiebreaker plus the NULL-safe LEFT JOIN appear.
			name: "position data with join and fullwidth column",
			info: &schema.CategoryInfo{
				TextColumns:      []string{"lg_code", "chiban"},
				PosColumns:       []string{"chiban", "rep_lon", "rep_lat"},
				JoinColumns:      []string{"lg_code"},
				FullwidthColumns: map[string]bool{"chiban": true},
			},
			hasPos: true,
			want: "CREATE OR REPLACE TEMP TABLE out AS\n" +
				"SELECT t.lg_code as lg_code, " +
				fmt.Sprintf("%s as chiban, ", convertFullWidthNumbers("t.chiban")) +
				"p.rep_lon as rep_lon, p.rep_lat as rep_lat, " +
				"ROW_NUMBER() OVER (PARTITION BY t.lg_code ORDER BY p.rep_lon, p.rep_lat) as join_seq\n" +
				"FROM txt t LEFT JOIN pos p ON t.lg_code IS NOT DISTINCT FROM p.lg_code\n",
		},
		{
			// Position data present but no join columns: no JOIN, constant join_seq,
			// yet pos-only columns still resolve to p.*.
			name: "position data without join columns",
			info: &schema.CategoryInfo{
				TextColumns: []string{"lg_code"},
				PosColumns:  []string{"rep_lat"},
			},
			hasPos: true,
			want: "CREATE OR REPLACE TEMP TABLE out AS\n" +
				"SELECT t.lg_code as lg_code, p.rep_lat as rep_lat, 1 as join_seq\n" +
				"FROM txt\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := newTransformer(tt.info).buildTransformSQL(tt.hasPos, tn)
			if got != tt.want {
				t.Errorf("buildTransformSQL mismatch:\n got: %q\nwant: %q", got, tt.want)
			}
		})
	}
}

func TestBuildInsertSQL(t *testing.T) {
	info := &schema.CategoryInfo{
		TableName:     "mt_parcel_unified",
		OutputColumns: []string{"lg_code", "chiban", "rep_lon"},
	}

	got, err := buildInsertSQL(info, "transformed_x")
	if err != nil {
		t.Fatalf("buildInsertSQL: %v", err)
	}
	want := `INSERT INTO pg."mt_parcel_unified" ("lg_code", "chiban", "rep_lon") ` +
		`SELECT "lg_code", "chiban", "rep_lon" FROM transformed_x WHERE join_seq = 1`
	if got != want {
		t.Errorf("buildInsertSQL mismatch:\n got: %q\nwant: %q", got, want)
	}
}

func TestBuildInsertSQL_RejectsUnsafeIdentifiers(t *testing.T) {
	tests := []struct {
		name string
		info *schema.CategoryInfo
	}{
		{"invalid table name", &schema.CategoryInfo{
			TableName:     `mt"; DROP TABLE x; --`,
			OutputColumns: []string{"lg_code"},
		}},
		{"invalid column name", &schema.CategoryInfo{
			TableName:     "mt_parcel_unified",
			OutputColumns: []string{"lg_code", "bad-col"},
		}},
		{"no output columns", &schema.CategoryInfo{
			TableName: "mt_parcel_unified",
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := buildInsertSQL(tt.info, "transformed_x"); err == nil {
				t.Error("buildInsertSQL: want error, got nil")
			}
		})
	}
}

// selectAliases extracts the output column names (the "as <alias>" list) of a
// buildTransformSQL statement.
func selectAliases(t *testing.T, transformSQL string) []string {
	t.Helper()
	lines := strings.Split(transformSQL, "\n")
	if len(lines) < 2 || !strings.HasPrefix(lines[1], "SELECT ") {
		t.Fatalf("unexpected transform SQL shape: %q", transformSQL)
	}
	var aliases []string
	for _, expr := range splitTopLevelCommas(strings.TrimPrefix(lines[1], "SELECT ")) {
		idx := strings.LastIndex(expr, " as ")
		if idx < 0 {
			t.Fatalf("column expression without alias: %q", expr)
		}
		aliases = append(aliases, expr[idx+len(" as "):])
	}
	return aliases
}

// splitTopLevelCommas splits a SELECT list on commas outside parentheses,
// so expressions like ROW_NUMBER() OVER (PARTITION BY a, b) stay whole.
func splitTopLevelCommas(s string) []string {
	var parts []string
	depth, start := 0, 0
	for i := range len(s) {
		switch s[i] {
		case '(':
			depth++
		case ')':
			depth--
		case ',':
			if depth == 0 {
				parts = append(parts, strings.TrimSpace(s[start:i]))
				start = i + 1
			}
		}
	}
	return append(parts, strings.TrimSpace(s[start:]))
}

// TestTransformColumnsMatchInsertColumns pins the column-alignment contract
// for every category in every shipped profile: the transform SELECT emits exactly
// OutputColumns (+ join_seq), which is the same list buildInsertSQL names on
// both the INSERT and SELECT side. A drift in either generator breaks this
// test instead of silently misaligning columns.
func TestTransformColumnsMatchInsertColumns(t *testing.T) {
	tn := tableNames{Text: "txt", Pos: "pos", Transformed: "out"}

	for _, profile := range schema.ProfileNames() {
		cfg, err := schema.LoadProfile(profile)
		if err != nil {
			t.Fatalf("parse %s config: %v", profile, err)
		}
		for name, info := range cfg.ToCategoryInfoMap() {
			for _, hasPos := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/%s_hasPos=%v", profile, name, hasPos), func(t *testing.T) {
					wantAliases := append(slices.Clone(info.OutputColumns), "join_seq")
					got := selectAliases(t, newTransformer(info).buildTransformSQL(hasPos, tn))
					if !slices.Equal(got, wantAliases) {
						t.Errorf("transform SELECT aliases = %v, want OutputColumns+join_seq %v", got, wantAliases)
					}

					insertSQL, err := buildInsertSQL(info, tn.Transformed)
					if err != nil {
						t.Fatalf("buildInsertSQL: %v", err)
					}
					for _, col := range info.OutputColumns {
						if !strings.Contains(insertSQL, `"`+col+`"`) {
							t.Errorf("insert SQL missing column %q: %s", col, insertSQL)
						}
					}
				})
			}
		}
	}
}
