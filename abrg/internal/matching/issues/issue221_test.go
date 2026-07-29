package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue221 tests partial address matching for "麻生"
// Issue #221: 「麻生」検索時に川崎市麻生区ではなく山口県萩市麻生が返される
// https://github.com/digital-go-jp/abr-geocoder/issues/221
//
// Node.js版では「麻生」で検索すると小字レベルの山口県萩市麻生がマッチしていた。
// しかし元データ（mt_town_fullset_pref35.csv）では萩市麻生はstatus_flg=0（廃止）。
// Go版ではstatus_flg=0のデータはインポートしないため、萩市麻生は存在しない。
// 結果として曖昧な入力はマッチしないか、より適切な結果を返す。
func TestIssue221(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 「麻生」のみ - 曖昧すぎるためマッチしない
			// Node.js版では「山口県萩市麻生」にマッチしていた
			name: "issue221-1 [麻生]",
			query: model.MatchQuery{
				Address:  "麻生",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelUnknown,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: []string{"麻生"}, // マッチなしのため全体が未マッチ
			wantStructured: map[string]any{
				FieldPref:         nil,
				FieldCounty:       nil,
				FieldCity:         nil,
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      nil,
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
		{
			// 「川崎市麻生区」- 明示的に指定すればマッチ
			name: "issue221-2 [川崎市麻生区]",
			query: model.MatchQuery{
				Address:  "川崎市麻生区",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "神奈川県川崎市麻生区",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "神奈川県",
				FieldCounty:       nil,
				FieldCity:         "川崎市",
				FieldWard:         "麻生区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      nil,
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
		{
			// 「麻生区」のみ - 麻生区を持つ市は川崎市だけなので市区町村レベルで確定する
			name: "issue221-3 [麻生区]",
			query: model.MatchQuery{
				Address:  "麻生区",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "神奈川県川崎市麻生区",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "神奈川県",
				FieldCounty:       nil,
				FieldCity:         "川崎市",
				FieldWard:         "麻生区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      nil,
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
		{
			// 「山口県萩市麻生」- 萩市はDB上に存在するためcityレベルでマッチ
			// 「麻生」は萩市の町字にないため未マッチに残る
			name: "issue221-4 [山口県萩市麻生]",
			query: model.MatchQuery{
				Address:  "山口県萩市麻生",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "山口県萩市",
			wantUnmatchedAddress: []string{"麻生"},
			wantStructured: map[string]any{
				FieldPref:         "山口県",
				FieldCounty:       nil,
				FieldCity:         "萩市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      nil,
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
		{
			// 「神奈川県川崎市麻生区」- 完全指定
			name: "issue221-5 [神奈川県川崎市麻生区]",
			query: model.MatchQuery{
				Address:  "神奈川県川崎市麻生区",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "神奈川県川崎市麻生区",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "神奈川県",
				FieldCounty:       nil,
				FieldCity:         "川崎市",
				FieldWard:         "麻生区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      nil,
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
