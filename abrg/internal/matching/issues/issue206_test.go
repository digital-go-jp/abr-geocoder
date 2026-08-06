package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue206 tests addresses where town number is added to parcel number
// Issue #206: 町字に含まれる数字が地番の先頭に追加される
// https://github.com/digital-go-jp/abr-geocoder/issues/206
//
// 「第N号」で終わる町字に地番が続くとき、号の数字と地番が繋がらないことを確認する。
func TestIssue206(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 香川県高松市塩江町安原下第1号958-4-1
			name: "issue206-1 [香川県高松市塩江町安原下第1号958-4-1]",
			query: model.MatchQuery{
				Address:  "香川県高松市塩江町安原下第1号958-4-1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "香川県高松市塩江町安原下第1号",
			wantUnmatchedAddress: []string{"958-4-1"},
			wantStructured: map[string]any{
				FieldPref:         "香川県",
				FieldCounty:       nil,
				FieldCity:         "高松市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "塩江町安原下第1号",
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
			// 香川県高松市塩江町安原下第3号540-1-25
			name: "issue206-2 [香川県高松市塩江町安原下第3号540-1-25]",
			query: model.MatchQuery{
				Address:  "香川県高松市塩江町安原下第3号540-1-25",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "香川県高松市塩江町安原下第3号",
			wantUnmatchedAddress: []string{"540-1-25"},
			wantStructured: map[string]any{
				FieldPref:         "香川県",
				FieldCounty:       nil,
				FieldCity:         "高松市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "塩江町安原下第3号",
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
