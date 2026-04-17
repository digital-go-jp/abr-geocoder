package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue89 tests that building floor/room numbers are not misinterpreted as chome
// Issue #89: ビル名の「５号」が「五丁目」として誤認識される
// https://github.com/digital-go-jp/abr-geocoder/issues/89
//
// ビル名に「５号」という文字が含まれると、それが「五丁目」という町名として誤認識される問題
func TestIssue89(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// ビルなし - 正常に処理される
		{
			name: "issue89-1 [京都府京都市中京区衣棚通姉小路下る突抜町７８５番地]",
			query: model.MatchQuery{
				Address:  "京都府京都市中京区衣棚通姉小路下る突抜町７８５番地",
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
		// ビル名のみ - 正常に処理される
		{
			name: "issue89-2 [京都府京都市中京区衣棚通姉小路下る突抜町７８５番地 デジタルビル]",
			query: model.MatchQuery{
				Address:  "京都府京都市中京区衣棚通姉小路下る突抜町７８５番地 デジタルビル",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "京都府京都市中京区衣棚通姉小路下る突抜町785",
			wantUnmatchedAddress: []string{"デジタルビル"},
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
		// ビル名＋号室 - 「５号」が丁目として誤認識されないこと
		{
			name: "issue89-3 [京都府京都市中京区衣棚通姉小路下る突抜町７８５番地 デジタルビル ５号]",
			query: model.MatchQuery{
				Address:  "京都府京都市中京区衣棚通姉小路下る突抜町７８５番地 デジタルビル ５号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "京都府京都市中京区衣棚通姉小路下る突抜町785",
			wantUnmatchedAddress: []string{"デジタルビル", "5号"},
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
	})
}
