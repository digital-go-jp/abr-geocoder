package matching

import (
	"context"
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/repository"
)

// lotRepo holds parcels as lg_code|machiaza_id|prc_num1 keys.
type lotRepo map[string]bool

func (lotRepo) FindBasicByAddress(context.Context, repository.BasicSearchParams) ([]repository.BasicResult, error) {
	return nil, nil
}

func (r lotRepo) HasParcelNum1(_ context.Context, lgCode, machiazaID, prcNum1 string) (bool, error) {
	return r[lgCode+"|"+machiazaID+"|"+prcNum1], nil
}

func TestSelectHoldingLot(t *testing.T) {
	candidate := func(machiazaID, oazaCho string, parcels int) model.MatchedResult {
		lgCode := "152226"
		return model.MatchedResult{
			IDs:               model.IDs{LgCode: &lgCode, MachiazaID: &machiazaID},
			StructuredAddress: model.StructuredAddress{OazaCho: &oazaCho},
			Machiaza:          model.MachiazaData{ParcelCount: parcels},
		}
	}
	oaza := candidate("0239000", "大字富岡", 4252) // without lot 3525
	plain := candidate("0581000", "富岡", 147)   // with lot 3525
	repo := lotRepo{"152226|0581000|3525": true, "152226|0239000|3525": false}

	tests := []struct {
		name       string
		candidates []model.MatchedResult
		addr       string
		want       string
	}{
		{"second candidate holds the lot", []model.MatchedResult{oaza, plain}, "新潟県上越市富岡3525", "0581000"},
		{"lot followed by a building number", []model.MatchedResult{oaza, plain}, "新潟県上越市富岡3525-1ビル507", "0581000"},
		{"input with 大字", []model.MatchedResult{oaza, plain}, "新潟県上越市大字富岡3525", "0581000"},
		{"no candidate holds the lot", []model.MatchedResult{oaza, plain}, "新潟県上越市富岡1", "0239000"},
		{"no lot", []model.MatchedResult{oaza, plain}, "新潟県上越市富岡", "0239000"},
		{"name not in the input", []model.MatchedResult{oaza, plain}, "新潟県上越市冨岡3525", "0239000"},
		{"single candidate", []model.MatchedResult{oaza}, "新潟県上越市富岡3525", "0239000"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := selectHoldingLot(context.Background(), repo, tt.candidates, tt.addr)
			if err != nil {
				t.Fatal(err)
			}
			if len(got) != 1 || *got[0].IDs.MachiazaID != tt.want {
				t.Errorf("selectHoldingLot() machiaza_id = %v, want %s", *got[0].IDs.MachiazaID, tt.want)
			}
		})
	}
}
