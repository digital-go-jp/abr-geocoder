package matching

import (
	"context"
	"testing"

	"abrg/internal/model"
	"abrg/internal/repository"
)

func TestAdjustMachiazaIDForChome(t *testing.T) {
	tests := []struct {
		name       string
		machiazaID string
		chomeNum   string
		expected   string
	}{
		{"standard", "0043000", "2", "0043002"},
		{"double digit", "0043000", "12", "0043012"},
		{"max valid chome", "0043000", "100", "0043100"},
		{"invalid length", "004300", "2", "004300"},
		{"empty chome", "0043000", "", "0043000"},
		{"chome too large (101)", "0043000", "101", "0043000"},
		{"chome too large (1000)", "0043000", "1000", "0043000"},
		{"chome zero", "0043000", "0", "0043000"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := adjustMachiazaIDForChome(tt.machiazaID, tt.chomeNum)
			if result != tt.expected {
				t.Errorf("adjustMachiazaIDForChome(%q, %q) = %q, want %q", tt.machiazaID, tt.chomeNum, result, tt.expected)
			}
		})
	}
}

func TestTwoStageSearchResidential(t *testing.T) {
	db := setupTestDB(t)
	search := newTwoStageSearch(repository.NewRepository(db))

	tests := []struct {
		name       string
		lgCode     string
		machiazaID string
		searchAddr string
		wantFound  bool
		wantBlkNum string
	}{
		{
			name:       "find block from searchAddr",
			lgCode:     "131032",
			machiazaID: "0001001", // 虎ノ門1丁目
			searchAddr: "港区虎ノ門1@:6",
			wantFound:  true,
			wantBlkNum: "6",
		},
		{
			name:       "block not found",
			lgCode:     "131032",
			machiazaID: "0001001",
			searchAddr: "港区虎ノ門1@:999",
			wantFound:  false,
		},
		{
			name:       "no number in searchAddr",
			lgCode:     "131032",
			machiazaID: "0001001",
			searchAddr: "港区虎ノ門1@",
			wantFound:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := search.searchResidential(context.Background(), tt.lgCode, tt.machiazaID, tt.searchAddr)
			if err != nil {
				t.Fatalf("searchResidential() error = %v", err)
			}
			if tt.wantFound {
				if result == nil {
					t.Errorf("searchResidential() = nil, want result")
					return
				}
				if result.StructuredAddress.BlkNum == nil || *result.StructuredAddress.BlkNum != tt.wantBlkNum {
					t.Errorf("BlkNum = %v, want %q", result.StructuredAddress.BlkNum, tt.wantBlkNum)
				}
			} else {
				if result != nil {
					t.Errorf("searchResidential() = %v, want nil", result)
				}
			}
		})
	}
}

func TestTwoStageSearchParcel(t *testing.T) {
	db := setupTestDB(t)
	search := newTwoStageSearch(repository.NewRepository(db))

	tests := []struct {
		name        string
		lgCode      string
		machiazaID  string
		searchAddr  string
		wantFound   bool
		wantPrcNum1 string
		wantPrcNum2 string
	}{
		{
			name:        "find parcel from searchAddr",
			lgCode:      "011037",
			machiazaID:  "0023001",
			searchAddr:  "札幌市東区北31条東1@:753-219",
			wantFound:   true,
			wantPrcNum1: "753",
			wantPrcNum2: "219",
		},
		{
			name:       "parcel not found - wrong number",
			lgCode:     "011037",
			machiazaID: "0023001",
			searchAddr: "札幌市東区北31条東1@:9999-9999",
			wantFound:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := search.searchParcel(context.Background(), tt.lgCode, tt.machiazaID, tt.searchAddr, 1)
			if err != nil {
				t.Fatalf("searchParcel() error = %v", err)
			}
			if tt.wantFound {
				if result == nil {
					t.Errorf("searchParcel() = nil, want result")
					return
				}
				if result.StructuredAddress.PrcNum1 == nil || *result.StructuredAddress.PrcNum1 != tt.wantPrcNum1 {
					t.Errorf("PrcNum1 = %v, want %q", result.StructuredAddress.PrcNum1, tt.wantPrcNum1)
				}
				if tt.wantPrcNum2 != "" {
					if result.StructuredAddress.PrcNum2 == nil || *result.StructuredAddress.PrcNum2 != tt.wantPrcNum2 {
						t.Errorf("PrcNum2 = %v, want %q", result.StructuredAddress.PrcNum2, tt.wantPrcNum2)
					}
				}
			} else {
				if result != nil {
					t.Errorf("searchParcel() = %v, want nil", result)
				}
			}
		})
	}
}

func Test_normalizeWithBasic(t *testing.T) {
	db := setupTestDB(t)
	search := newTwoStageSearch(repository.NewRepository(db))

	// Create mock basicResults
	lgCode := "131032"
	machiazaID := "0001001"
	pref := "東京都"
	city := "港区"
	oazaCho := "虎ノ門"
	chome := "1丁目"

	basicResults := []model.MatchedResult{
		{
			IDs: model.IDs{
				LgCode:     &lgCode,
				MachiazaID: &machiazaID,
			},
			StructuredAddress: model.StructuredAddress{
				Pref:    &pref,
				City:    &city,
				OazaCho: &oazaCho,
				Chome:   &chome,
			},
		},
	}

	t.Run("residential search with basic", func(t *testing.T) {
		results, err := search.normalizeWithBasic(
			context.Background(),
			model.CategoryResidential,
			basicResults,
			"港区虎ノ門1@:6",
		)
		if err != nil {
			t.Fatalf("normalizeWithBasic() error = %v", err)
		}

		if len(results) == 0 {
			t.Fatal("normalizeWithBasic returned no results")
		}

		result := results[0]
		if result.StructuredAddress.BlkNum == nil || *result.StructuredAddress.BlkNum != "6" {
			t.Errorf("BlkNum = %v, want \"6\"", result.StructuredAddress.BlkNum)
		}
		// Should have merged pref from basicResults
		if result.StructuredAddress.Pref == nil || *result.StructuredAddress.Pref != "東京都" {
			t.Errorf("Pref = %v, want \"東京都\"", result.StructuredAddress.Pref)
		}
	})

	t.Run("returns nil when not found", func(t *testing.T) {
		results, err := search.normalizeWithBasic(
			context.Background(),
			model.CategoryResidential,
			basicResults,
			"港区虎ノ門1@:999",
		)
		if err != nil {
			t.Fatalf("normalizeWithBasic() error = %v", err)
		}

		if results != nil {
			t.Errorf("normalizeWithBasic returned %v, want nil", results)
		}
	})
}
