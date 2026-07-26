package schema

import (
	"slices"
	"testing"
)

// TestToCategoryInfo_OutputColumns pins the OutputColumns contract: text
// columns first, then pos-only columns, duplicates dropped on first-seen
// order — the same order mergeColumns uses for the PostgreSQL DDL.
func TestToCategoryInfo_OutputColumns(t *testing.T) {
	cat := &CategoryConfig{
		TableName:   "mt_parcel_unified",
		TextColumns: []ColumnDef{{Name: "lg_code"}, {Name: "chiban"}},
		PosColumns:  []ColumnDef{{Name: "lg_code"}, {Name: "rep_lon"}, {Name: "rep_lat"}},
	}

	info := cat.toCategoryInfo()
	want := []string{"lg_code", "chiban", "rep_lon", "rep_lat"}
	if !slices.Equal(info.OutputColumns, want) {
		t.Errorf("OutputColumns = %v, want %v", info.OutputColumns, want)
	}
}

// TestOutputColumnsMatchDDLOrder pins that for every category in the default
// config, OutputColumns equals the column order of the generated DDL.
func TestOutputColumnsMatchDDLOrder(t *testing.T) {
	cfg, err := ParseImportConfig(DefaultConfigYAML)
	if err != nil {
		t.Fatalf("parse default config: %v", err)
	}
	for name, cat := range cfg.Category {
		merged := cat.mergeColumns()
		ddlOrder := make([]string, len(merged))
		for i, col := range merged {
			ddlOrder[i] = col.Name
		}
		if got := cat.toCategoryInfo().OutputColumns; !slices.Equal(got, ddlOrder) {
			t.Errorf("category %s: OutputColumns = %v, want DDL order %v", name, got, ddlOrder)
		}
	}
}
