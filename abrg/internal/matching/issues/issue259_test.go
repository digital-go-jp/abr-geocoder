package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue259 tests matching of numeric-only koaza with half-width digit input
// Issue #259: 数字のみの小字（例: 七尾市大田町111）が半角数字入力でマッチしない
// https://github.com/digital-go-jp/abr-geocoder/issues/259
//
// 問題:
// - 「七尾市大田町壱壱壱-11」→ koaza=111 の小字にマッチし parcel まで到達する
// - 「七尾市大田町111-11」　→ 大田町の基底で止まり「111-11」が unmatched になる
//
// 同一の小字を指す2表記で結果が異なる。数字小字は AddColon で丁目/地番として
// 分割され、フォールバックも丁目マーカー付き（base+数字+@）しか照会しないため、
// @なしで格納されている数字小字レコードに到達できない。
func TestIssue259(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// 数字小字そのもの（石川県七尾市大田町 小字111 = machiaza_id 0022145）
		{
			name: "issue259-1 [七尾市大田町111]",
			query: model.MatchQuery{
				Address:  "七尾市大田町111",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県七尾市大田町111",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "石川県",
				FieldCity:    "七尾市",
				FieldOazaCho: "大田町",
				FieldChome:   nil,
				FieldKoaza:   "111",
			},
		},
		// 数字小字 + 地番（漢数字入力「壱壱壱-11」と同じ結果になるべき）
		{
			name: "issue259-2 [七尾市大田町111-11]",
			query: model.MatchQuery{
				Address:  "七尾市大田町111-11",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "石川県",
				FieldCity:    "七尾市",
				FieldOazaCho: "大田町",
				FieldKoaza:   "111",
				FieldPrcNum1: "11",
			},
		},
		// 1桁の数字小字（輪島市大野町 小字1 = machiaza_id 0010101）
		{
			name: "issue259-3 [石川県輪島市大野町1]",
			query: model.MatchQuery{
				Address:  "石川県輪島市大野町1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県輪島市大野町1",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "石川県",
				FieldCity:    "輪島市",
				FieldOazaCho: "大野町",
				FieldChome:   nil,
				FieldKoaza:   "1",
			},
		},
		// 数字小字 + 建物名（小字のみで止まる経路でもビル名が unmatched に残ること）
		{
			name: "issue259-6 [七尾市大田町111 大田ビル202]",
			query: model.MatchQuery{
				Address:  "七尾市大田町111 大田ビル202",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県七尾市大田町111",
			wantUnmatchedAddress: []string{"大田ビル202"},
			wantStructured: map[string]any{
				FieldPref:    "石川県",
				FieldCity:    "七尾市",
				FieldOazaCho: "大田町",
				FieldKoaza:   "111",
			},
		},
		// 数字小字 + 地番 + 建物名（地番まで進む経路）
		{
			name: "issue259-7 [七尾市大田町111-11 大田ビル202]",
			query: model.MatchQuery{
				Address:  "七尾市大田町111-11 大田ビル202",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantUnmatchedAddress: []string{"大田ビル202"},
			wantStructured: map[string]any{
				FieldPref:    "石川県",
				FieldCity:    "七尾市",
				FieldOazaCho: "大田町",
				FieldKoaza:   "111",
				FieldPrcNum1: "11",
			},
		},
		// 回帰確認: 丁目解釈が優先されること（紀尾井町1-3 は住居表示）
		{
			name: "issue259-4 [東京都千代田区紀尾井町1-3] 回帰",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀尾井町1-3",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "千代田区",
				FieldOazaCho: "紀尾井町",
				FieldKoaza:   nil,
				FieldBlkNum:  "1",
				FieldRsdtNum: "3",
			},
		},
		// 回帰確認: 通常の地番（町名+数字が町字に存在しないケース）
		{
			name: "issue259-5 [茨城県つくば市筑穂1-10-4] 回帰",
			query: model.MatchQuery{
				Address:  "茨城県つくば市筑穂1-10-4",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "茨城県",
				FieldCity:    "つくば市",
				FieldOazaCho: "筑穂",
				FieldChome:   "1丁目",
				FieldPrcNum1: "10",
				FieldPrcNum2: "4",
			},
		},
	})
}
