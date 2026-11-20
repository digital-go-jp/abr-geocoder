package reverse

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/repository"
)

// TestBuildFeatureCarriesNumbers checks that the block, residence and lot
// numbers and their IDs reach structured_address and ids.
func TestBuildFeatureCarriesNumbers(t *testing.T) {
	base := repository.ReverseBaseFields{Pref: "東京都", City: "練馬区", OazaCho: new("田柄"), Chome: new("四丁目"), LgCode: "131202", MachiazaID: "0011004"}

	t.Run("residential", func(t *testing.T) {
		got := buildResidentialFeature(repository.ReverseResidentialResult{
			ReverseBaseFields: base,
			BlkID:             new("020"), RsdtID: new("030"), Rsdt2ID: new("0036"),
			BlkNum: new("20"), RsdtNum: new("30"), RsdtNum2: new("36"),
		}).Properties
		sa, ids := got.StructuredAddress, got.IDs
		assertStringFields(t, []stringField{
			{"blk_num", sa.BlkNum, "20"}, {"rsdt_num", sa.RsdtNum, "30"}, {"rsdt_num2", sa.RsdtNum2, "36"},
			{"blk_id", ids.BlkID, "020"}, {"rsdt_id", ids.RsdtID, "030"}, {"rsdt2_id", ids.Rsdt2ID, "0036"},
		})
	})

	t.Run("parcel", func(t *testing.T) {
		got := buildParcelFeature(repository.ReverseParcelResult{
			ReverseBaseFields: base,
			PrcID:             new("000120000300004"),
			PrcNum1:           new("12"), PrcNum2: new("3"), PrcNum3: new("4"),
		}).Properties
		sa, ids := got.StructuredAddress, got.IDs
		assertStringFields(t, []stringField{
			{"prc_num1", sa.PrcNum1, "12"}, {"prc_num2", sa.PrcNum2, "3"}, {"prc_num3", sa.PrcNum3, "4"},
			{"prc_id", ids.PrcID, "000120000300004"},
		})
		if got.MatchLevel != model.MatchLevelParcel {
			t.Errorf("match_level = %v, want %v", got.MatchLevel, model.MatchLevelParcel)
		}
	})
}

type stringField struct {
	name string
	got  *string
	want string
}

func assertStringFields(t *testing.T, fields []stringField) {
	t.Helper()
	for _, f := range fields {
		if f.got == nil || *f.got != f.want {
			t.Errorf("%s = %v, want %q", f.name, f.got, f.want)
		}
	}
}
