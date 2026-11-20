package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestCorpusInputs pins real corporate addresses that take paths no other
// regression case reaches.
func TestCorpusInputs(t *testing.T) {
	query := func(address string, category model.Category) model.MatchQuery {
		return model.MatchQuery{Address: address, Category: category, Pref: "all", Limit: 1}
	}
	tests := []normalizeTestCase{
		{
			// A hyphen right after 丁目 opens the block number, and the building
			// name after it stays unmatched.
			// lg_code=011011 machiaza_id=0064003 is 南3条東3丁目.
			name:                 "chome followed by hyphen and building",
			query:                query("北海道札幌市中央区南三条東３丁目－８ラフィネタワー２１０２", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "北海道札幌市中央区南3条東3丁目",
			wantUnmatchedAddress: []string{"-8ラフィネタワー2102"},
		},
		{
			// The number before a trailing hyphen is the 丁目.
			// lg_code=122271 machiaza_id=0018002 is 舞浜2丁目.
			name:               "trailing hyphen after chome number",
			query:              query("千葉県浦安市舞浜2-", model.CategoryAll),
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "千葉県浦安市舞浜2丁目",
		},
		{
			// The town is looked up under the city corrected from ●木市.
			// lg_code=272116 machiaza_id=0128000 is 中津町 in 茨木市.
			name:                 "town under corrected city",
			query:                query("大阪府●木市中津町５番２号の３", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "大阪府茨木市中津町",
			wantUnmatchedAddress: []string{"5-2-3"},
		},
		{
			// 1Ｆ－Ｂ in the building name is not a branch of the lot.
			// lg_code=122076 machiaza_id=0076000 is 根本.
			name:                 "letter after hyphen is not a lot branch",
			query:                query("千葉県松戸市根本１４番地の２パークスカイタワー松戸１Ｆ－Ｂ", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "千葉県松戸市根本14-2",
			wantUnmatchedAddress: []string{"パークスカイタワー松戸1F-B"},
		},
		{
			// The closer spelling wins over a less similar town that reaches a
			// deeper level.
			// lg_code=261017 machiaza_id=0098000 is 上賀茂蟬ケ垣内町.
			name:                 "score ranks before match level",
			query:                query("京都府京都市北区上賀茂蝉ケ垣内町５１番地", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "京都府京都市北区上賀茂蟬ケ垣内町",
			wantUnmatchedAddress: []string{"51"},
		},
		{
			// The ward that holds the lot is inserted, and weaker matches in
			// other wards do not leave the ward undecided.
			// lg_code=141518 machiaza_id=0001000 is 田名 in 緑区.
			name:               "ward inserted for designated city",
			query:              query("神奈川県相模原市田名２１９０番地１", model.CategoryAll),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "神奈川県相模原市緑区田名2190-1",
		},
	}
	for _, category := range []model.Category{model.CategoryParcel, model.CategoryResidential} {
		tests = append(tests,
			normalizeTestCase{
				// The misspelled city is corrected without a prefecture.
				// lg_code=102016 machiaza_id=0030001 is 大手町一丁目 in 前橋市.
				name:                 "misspelled city without prefecture " + string(category),
				query:                query("前檎市大手町1丁目1-1", category),
				wantMatchLevel:       model.MatchLevelMachiazaDetail,
				wantMatchedAddress:   "群馬県前橋市大手町一丁目",
				wantUnmatchedAddress: []string{},
			},
			normalizeTestCase{
				// The town is looked up under the city corrected from 鷹栖村.
				// lg_code=014524 machiaza_id=0001106 is 10線3号 in 鷹栖町.
				name:               "town under corrected city " + string(category),
				query:              query("北海道上川郡鷹栖村10線3号", category),
				wantMatchLevel:     model.MatchLevelMachiazaDetail,
				wantMatchedAddress: "北海道上川郡鷹栖町10線3号",
			},
		)
	}
	runNormalizeTests(t, tests)
}
