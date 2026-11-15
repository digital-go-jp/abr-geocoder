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
	candidate := func(lgCode, machiazaID string) model.MatchedResult {
		return model.MatchedResult{IDs: model.IDs{LgCode: &lgCode, MachiazaID: &machiazaID}}
	}
	oaza := candidate("152226", "0239000")  // 大字富岡, without lot 3525
	plain := candidate("152226", "0581000") // 富岡, with lot 3525
	repo := lotRepo{"152226|0581000|3525": true}

	tests := []struct {
		name       string
		candidates []model.MatchedResult
		lot        string
		want       string
	}{
		{"second candidate holds the lot", []model.MatchedResult{oaza, plain}, "3525", "0581000"},
		{"no candidate holds the lot", []model.MatchedResult{oaza, plain}, "1", "0239000"},
		{"no lot", []model.MatchedResult{oaza, plain}, "", "0239000"},
		{"single candidate", []model.MatchedResult{oaza}, "3525", "0239000"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := selectHoldingLot(context.Background(), repo, tt.candidates, tt.lot)
			if err != nil {
				t.Fatal(err)
			}
			if len(got) != 1 || *got[0].IDs.MachiazaID != tt.want {
				t.Errorf("selectHoldingLot() machiaza_id = %v, want %s", *got[0].IDs.MachiazaID, tt.want)
			}
		})
	}
}
