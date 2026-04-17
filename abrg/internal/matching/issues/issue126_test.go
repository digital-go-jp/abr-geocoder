package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue126 tests handling of addresses where residential address implementation
// and non-implementation areas coexist in the same district
// Issue #126: 同一大字・町・丁目に住居表示実施区域と未実施区域が併存する場合の対応
// https://github.com/digital-go-jp/abr-geocoder/issues/126
//
// Some districts have both:
// - rsdt_addr_flg=1 (住居表示実施区域): addresses like 1番1号
// - rsdt_addr_flg=0 (住居表示未実施区域): addresses like 100番地
//
// The system should correctly handle both types based on the category parameter.
func TestIssue126(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// 紀尾井町: 住居表示実施区域のみ (rsdt_addr_flg=1)
		// category=all で住居表示データが優先される
		{
			name: "issue126-1a [東京都千代田区紀尾井町1-3] category=all - residential priority",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀尾井町1-3",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都千代田区紀尾井町1-3",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "千代田区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "紀尾井町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       "1",
				FieldRsdtNum:      "3",
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue126-1b [東京都千代田区紀尾井町1-3] category=rsdtdsp - residential only",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀尾井町1-3",
				Category: model.CategoryResidential,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都千代田区紀尾井町1-3",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "千代田区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "紀尾井町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       "1",
				FieldRsdtNum:      "3",
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue126-1c [東京都千代田区紀尾井町1-3] category=parcel - parcel only (no match)",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀尾井町1-3",
				Category: model.CategoryParcel,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "東京都千代田区紀尾井町",
			wantUnmatchedAddress: []string{"1-3"},
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "千代田区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "紀尾井町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 京都の例: 地番データのみ (rsdt_addr_flg=0)
		{
			name: "issue126-2a [京都市中京区突抜町785] category=all - parcel data",
			query: model.MatchQuery{
				Address:  "京都市中京区衣棚通姉小路下る突抜町785番地",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "京都府京都市中京区衣棚通姉小路下る突抜町785",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "京都府",
				FieldCounty:       nil,
				FieldCity:         "京都市",
				FieldWard:         "中京区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      "衣棚通姉小路下る",
				FieldOazaCho:      "突抜町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "785",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue126-2b [京都市中京区突抜町785] category=parcel - parcel only",
			query: model.MatchQuery{
				Address:  "京都市中京区衣棚通姉小路下る突抜町785番地",
				Category: model.CategoryParcel,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "京都府京都市中京区衣棚通姉小路下る突抜町785",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "京都府",
				FieldCounty:       nil,
				FieldCity:         "京都市",
				FieldWard:         "中京区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      "衣棚通姉小路下る",
				FieldOazaCho:      "突抜町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "785",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue126-2c [京都市中京区突抜町132] category=rsdtdsp - residential only (no match at detail level)",
			query: model.MatchQuery{
				Address:  "京都市中京区衣棚通姉小路下る突抜町132番地",
				Category: model.CategoryResidential,
				Pref:     "all",
				Limit:    1,
			},
			// 住居表示データがないので町字レベルでマッチ
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "京都府京都市中京区衣棚通姉小路下る突抜町",
			wantUnmatchedAddress: []string{"132"},
			wantStructured: map[string]any{
				FieldPref:         "京都府",
				FieldCounty:       nil,
				FieldCity:         "京都市",
				FieldWard:         "中京区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      "衣棚通姉小路下る",
				FieldOazaCho:      "突抜町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
	})
}
