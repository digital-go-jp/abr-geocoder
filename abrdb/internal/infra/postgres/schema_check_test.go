package postgres

import (
	"slices"
	"testing"
)

func TestMissingTableColumns(t *testing.T) {
	required := map[string][]string{
		"mt_city_unified": {"lg_code", "city"},
		"mt_pref_unified": {"lg_code", "pref"},
	}

	tests := []struct {
		name   string
		actual map[string]map[string]bool
		want   []string
	}{
		{
			name: "all present",
			actual: map[string]map[string]bool{
				"mt_city_unified": {"lg_code": true, "city": true},
				"mt_pref_unified": {"lg_code": true, "pref": true},
			},
			want: nil,
		},
		{
			name: "extra columns are tolerated",
			actual: map[string]map[string]bool{
				"mt_city_unified": {"lg_code": true, "city": true, "city_kana": true},
				"mt_pref_unified": {"lg_code": true, "pref": true},
			},
			want: nil,
		},
		{
			name: "missing table",
			actual: map[string]map[string]bool{
				"mt_pref_unified": {"lg_code": true, "pref": true},
			},
			want: []string{"table mt_city_unified is missing"},
		},
		{
			name: "missing columns",
			actual: map[string]map[string]bool{
				"mt_city_unified": {"lg_code": true},
				"mt_pref_unified": {"lg_code": true, "pref": true},
			},
			want: []string{"table mt_city_unified is missing columns: city"},
		},
		{
			name:   "everything missing reports in table order",
			actual: map[string]map[string]bool{},
			want: []string{
				"table mt_city_unified is missing",
				"table mt_pref_unified is missing",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := missingTableColumns(required, tt.actual)
			if !slices.Equal(got, tt.want) {
				t.Errorf("missingTableColumns() = %v, want %v", got, tt.want)
			}
		})
	}
}
