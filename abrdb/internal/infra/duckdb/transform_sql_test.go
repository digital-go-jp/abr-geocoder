package duckdb

import (
	"fmt"
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
			// dedup ROW_NUMBER plus the NULL-safe LEFT JOIN appear.
			name: "position data with join and fullwidth column",
			info: &schema.CategoryInfo{
				TextColumns:      []string{"lg_code", "chiban"},
				PosColumns:       []string{"chiban", "rep_lat"},
				JoinColumns:      []string{"lg_code"},
				FullwidthColumns: map[string]bool{"chiban": true},
			},
			hasPos: true,
			want: "CREATE OR REPLACE TEMP TABLE out AS\n" +
				"SELECT t.lg_code as lg_code, " +
				fmt.Sprintf("%s as chiban, ", convertFullWidthNumbers("t.chiban")) +
				"p.rep_lat as rep_lat, " +
				"ROW_NUMBER() OVER (PARTITION BY t.lg_code ORDER BY 1) as join_seq\n" +
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
