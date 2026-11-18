package matching

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/repository"
)

// lotRepo holds the numbers of each machiaza_id.
// A parcel is "prc_num1" or "prc_num1-prc_num2".
// A residential number is "blk_num-rsdt_num", or "blk_num" for a block with none recorded.
// A machiaza_id missing from a map fails the query, as a table missing from the cache would.
type lotRepo struct {
	parcels     map[string][]string
	residential map[string][]string
}

var errUnexpectedQuery = errors.New("unexpected query")

func (lotRepo) FindBasicByAddress(context.Context, repository.BasicSearchParams) ([]repository.BasicResult, error) {
	return nil, nil
}

func (r lotRepo) ParcelLotMatch(_ context.Context, _, machiazaID, prcNum1, prcNum2 string) (repository.LotMatch, error) {
	nums, ok := r.parcels[machiazaID]
	if !ok {
		return repository.LotMatchNone, errUnexpectedQuery
	}
	match := repository.LotMatchNone
	for _, n := range nums {
		switch {
		case n == prcNum1 && prcNum2 == "" || n == prcNum1+"-"+prcNum2:
			return repository.LotMatchWhole, nil
		case n == prcNum1 || strings.HasPrefix(n, prcNum1+"-"):
			match = repository.LotMatchFirst
		}
	}
	return match, nil
}

func (r lotRepo) ResidentialLotMatch(_ context.Context, _, machiazaID, blkNum, rsdtNum string) (repository.LotMatch, error) {
	nums, ok := r.residential[machiazaID]
	if !ok {
		return repository.LotMatchNone, errUnexpectedQuery
	}
	match := repository.LotMatchNone
	for _, n := range nums {
		switch {
		case n == blkNum || n == blkNum+"-"+rsdtNum:
			return repository.LotMatchWhole, nil
		case strings.HasPrefix(n, blkNum+"-"):
			if rsdtNum == "" {
				return repository.LotMatchWhole, nil
			}
			match = repository.LotMatchFirst
		}
	}
	return match, nil
}

func TestSelectHoldingLot(t *testing.T) {
	candidate := func(machiazaID string, parcels, residential int) model.MatchedResult {
		lgCode := "132241"
		return model.MatchedResult{
			IDs:      model.IDs{LgCode: &lgCode, MachiazaID: &machiazaID},
			Machiaza: model.MachiazaData{ParcelCount: parcels, RsdtdspCount: residential},
		}
	}
	oaza := candidate("0030000", 252, 0)    // holds parcels 1450 and 3525
	plain := candidate("0009000", 125, 0)   // holds parcels 1450-1 and 3525
	empty := candidate("0001000", 0, 0)     // holds no numbers
	blocks := candidate("0002000", 0, 30)   // holds residential number 1450-2
	bareBlock := candidate("0003000", 9, 7) // holds parcel 1450 and block 1450 with no residential numbers
	repo := lotRepo{
		parcels: map[string][]string{
			"0030000": {"1450", "3525"},
			"0009000": {"1450-1", "3525"},
			"0003000": {"1450"},
		},
		residential: map[string][]string{
			"0002000": {"1450-2"},
			"0003000": {"1450"},
		},
	}

	tests := []struct {
		name     string
		all      []model.MatchedResult
		top      []model.MatchedResult
		lot      string
		category model.Category
		want     string
	}{
		{"tied candidate holding the whole lot", nil, []model.MatchedResult{oaza, plain}, "1450-1", "", "0009000"},
		{"tied candidates holding prc_num1 keep their order", nil, []model.MatchedResult{oaza, plain}, "3525", "", "0030000"},
		{"prc_num1 decides when no candidate holds the whole lot", nil, []model.MatchedResult{plain, oaza}, "1450-9", "", "0009000"},
		{"no tied candidate holds the lot", nil, []model.MatchedResult{oaza, plain}, "1", "", "0030000"},
		{"no lot", nil, []model.MatchedResult{oaza, plain}, "", "", "0030000"},
		{"single tied candidate", nil, []model.MatchedResult{oaza}, "1450-1", "", "0030000"},
		{"residential block alone ranks above prc_num1 alone", nil, []model.MatchedResult{oaza, blocks}, "1450-9", "", "0002000"},
		{"whole parcel ranks above residential block alone", nil, []model.MatchedResult{blocks, plain}, "1450-1", "", "0009000"},
		{"block with no residential numbers recorded holds the whole lot", nil, []model.MatchedResult{bareBlock, plain}, "1450-1", "", "0003000"},
		{"top without numbers falls to a candidate holding the lot", []model.MatchedResult{empty, plain}, []model.MatchedResult{empty}, "1450-1", "", "0009000"},
		{"top without numbers stays when no candidate holds the lot", []model.MatchedResult{empty, plain}, []model.MatchedResult{empty}, "1", "", "0001000"},
		{"tied spelling is preferred to another spelling", []model.MatchedResult{plain, empty, bareBlock}, []model.MatchedResult{empty, bareBlock}, "1450-1", "", "0003000"},
		{"top holding residential numbers is kept", []model.MatchedResult{blocks, plain}, []model.MatchedResult{blocks}, "1450-1", "", "0002000"},
		{"parcel category ignores residential numbers", nil, []model.MatchedResult{blocks, plain}, "1450-2", model.CategoryParcel, "0009000"},
		{"residential category ignores parcels", nil, []model.MatchedResult{plain, blocks}, "1450-1", model.CategoryResidential, "0002000"},
		{"lot without prc_num2 prefers the parcel without one", nil, []model.MatchedResult{plain, oaza}, "1450", "", "0030000"},
		{"top holding parcels is kept over another spelling", []model.MatchedResult{oaza, plain}, []model.MatchedResult{oaza}, "1450-1", "", "0030000"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			all := tt.all
			if all == nil {
				all = tt.top
			}
			got, err := selectHoldingLot(context.Background(), repo, all, tt.top, lotQuery{tt.lot, tt.category})
			if err != nil {
				t.Fatal(err)
			}
			if len(got) != 1 {
				t.Fatalf("selectHoldingLot() returned %d results, want 1", len(got))
			}
			if *got[0].IDs.MachiazaID != tt.want {
				t.Errorf("selectHoldingLot() machiaza_id = %s, want %s", *got[0].IDs.MachiazaID, tt.want)
			}
		})
	}
}

func TestSplitLot(t *testing.T) {
	tests := []struct {
		in, num1, num2 string
	}{
		{"295-48", "295", "48"},
		{"1450", "1450", ""},
		{"1493-1シャロンパーク多摩・永山507", "1493", "1"},
		{"6-ロ", "6", "ロ"},
		{"-12-3", "12", "3"},
		{"", "", ""},
		{"イ-1", "", ""},
	}
	for _, tt := range tests {
		num1, num2 := splitLot(tt.in)
		if num1 != tt.num1 || num2 != tt.num2 {
			t.Errorf("splitLot(%q) = (%q, %q), want (%q, %q)", tt.in, num1, num2, tt.num1, tt.num2)
		}
	}
}

// lotRepoWithBasic returns basic rows by search address on top of lotRepo.
type lotRepoWithBasic struct {
	lotRepo
	basic map[string][]repository.BasicResult
}

func (r lotRepoWithBasic) FindBasicByAddress(_ context.Context, p repository.BasicSearchParams) ([]repository.BasicResult, error) {
	return r.basic[p.Address], nil
}

func TestDetectMachiazaTrailingHyphenHasNoLot(t *testing.T) {
	chome := "1"
	row := func(machiazaID string, residential int) repository.BasicResult {
		return repository.BasicResult{
			NormalizedAddress: "市町1@", LgCode: "132241", MachiazaID: machiazaID,
			City: "多摩市", Chome: &chome, RsdtdspCount: residential,
		}
	}
	// The trailing "1" is the chome, so block 1 of 0002000 must not decide.
	// A query for it fails, as lotRepo has no residential entry for it.
	repo := lotRepoWithBasic{
		basic: map[string][]repository.BasicResult{"市町1@": {row("0001000", 0), row("0002000", 5)}},
	}
	got, _, err := detectMachiaza(context.Background(), repo, "市町1-", "13", "市町1-", lotQuery{})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || *got[0].IDs.MachiazaID != "0001000" {
		t.Fatalf("detectMachiaza() = %+v, want machiaza_id 0001000", got)
	}
}
