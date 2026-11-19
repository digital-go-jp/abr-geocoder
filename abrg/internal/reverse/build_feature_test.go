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
		assertStringFields(t, map[string]*string{
			"blk_num": sa.BlkNum, "rsdt_num": sa.RsdtNum, "rsdt_num2": sa.RsdtNum2,
			"blk_id": ids.BlkID, "rsdt_id": ids.RsdtID, "rsdt2_id": ids.Rsdt2ID,
		}, map[string]string{
			"blk_num": "20", "rsdt_num": "30", "rsdt_num2": "36",
			"blk_id": "020", "rsdt_id": "030", "rsdt2_id": "0036",
		})
	})

	t.Run("parcel", func(t *testing.T) {
		got := buildParcelFeature(repository.ReverseParcelResult{
			ReverseBaseFields: base,
			PrcID:             new("000120000300004"),
			PrcNum1:           new("12"), PrcNum2: new("3"), PrcNum3: new("4"),
		}).Properties
		sa, ids := got.StructuredAddress, got.IDs
		assertStringFields(t, map[string]*string{
			"prc_num1": sa.PrcNum1, "prc_num2": sa.PrcNum2, "prc_num3": sa.PrcNum3, "prc_id": ids.PrcID,
		}, map[string]string{
			"prc_num1": "12", "prc_num2": "3", "prc_num3": "4", "prc_id": "000120000300004",
		})
		if got.MatchLevel != model.MatchLevelParcel {
			t.Errorf("match_level = %v, want %v", got.MatchLevel, model.MatchLevelParcel)
		}
	})
}

func assertStringFields(t *testing.T, got map[string]*string, want map[string]string) {
	t.Helper()
	for k, w := range want {
		if g := got[k]; g == nil || *g != w {
			t.Errorf("%s = %v, want %q", k, g, w)
		}
	}
}
