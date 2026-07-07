package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue203 tests addresses where town name might be added twice
// Issue #203: 町字が二重で追加される
// https://github.com/digital-go-jp/abr-geocoder/issues/203
//
// Node.js版では「芦村町アラコ」→「芦町村町アラコ」と町字が二重になっていた。
// Go版では正しくマッチすることを確認する。
func TestIssue203(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 愛知県田原市芦村町アラコ
			// Node.js版では「芦町村町アラコ」になっていた
			name: "issue203-1 [愛知県田原市芦村町アラコ]",
			query: model.MatchQuery{
				Address:  "愛知県田原市芦村町アラコ",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛知県田原市芦村町アラコ",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "愛知県",
				FieldCounty:       nil,
				FieldCity:         "田原市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "芦村町",
				FieldChome:        nil,
				FieldKoaza:        "アラコ",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			// 愛知県田原市芦村町小山田
			name: "issue203-2 [愛知県田原市芦村町小山田]",
			query: model.MatchQuery{
				Address:  "愛知県田原市芦村町小山田",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛知県田原市芦村町小山田",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "愛知県",
				FieldCounty:       nil,
				FieldCity:         "田原市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "芦村町",
				FieldChome:        nil,
				FieldKoaza:        "小山田",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			// 京都府京都市北区西賀茂北鎮守庵町 - 京都の複合町字名
			// Node.js版では「西賀茂中島町北鎮守庵町」と町字が二重になっていた
			// Go版では「西賀茂北鎮守菴町」として正しくマッチ（庵→菴は異体字）
			name: "issue203-3 [京都府京都市北区西賀茂北鎮守庵町100-2]",
			query: model.MatchQuery{
				Address:  "京都府京都市北区西賀茂北鎮守庵町100-2",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			// 庵→菴 は同字数1文字置換なので、曖昧マッチ後も地番まで到達する (#246)。
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "京都府京都市北区西賀茂北鎮守菴町100-2",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "京都府",
				FieldCounty:       nil,
				FieldCity:         "京都市",
				FieldWard:         "北区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "西賀茂北鎮守菴町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "100",
				FieldPrcNum2:      "2",
				FieldPrcNum3:      nil,
			},
		},
	})
}
