package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue290 tests that a koaza ending with a kanji numeral followed by 字 stays intact.
// Issue #290: 小字が漢数字+字で終わる住所で、完全一致でも数字がアンマッチとして返る
// https://github.com/digital-go-jp/abr-geocoder/issues/290
//
// 問題:
//   - 「字三字」のような小字は、末尾の「字」が単独の字マーカーとして除去され、
//     残った漢数字が算用数字に変換されて地番として切り出される
//   - 入力と matched_address が完全一致していても unmatched_address に数字が残る
//   - 保護条件が unicode.IsDigit だったため、算用数字+字（「22字」）だけが保護されていた
//
// 解決:
// - 漢数字と大字数字も保護対象に含め、小字名の一部として残す
func TestIssue290(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// 漢数字 + 字
		{
			name: "issue290-1 [愛知県名古屋市港区南陽町大字小川新田字三字]",
			query: model.MatchQuery{
				Address:  "愛知県名古屋市港区南陽町大字小川新田字三字",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛知県名古屋市港区南陽町大字小川新田字三字",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "愛知県",
				FieldCity:    "名古屋市",
				FieldWard:    "港区",
				FieldOazaCho: "南陽町大字小川新田",
				FieldKoaza:   "字三字",
			},
		},
		{
			name: "issue290-2 [山形県最上郡舟形町舟形字小田山外二字]",
			query: model.MatchQuery{
				Address:  "山形県最上郡舟形町舟形字小田山外二字",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "山形県最上郡舟形町舟形字小田山外二字",
			wantUnmatchedAddress: nil,
		},
		{
			name: "issue290-3 [石川県鳳珠郡能登町字柿生地七字]",
			query: model.MatchQuery{
				Address:  "石川県鳳珠郡能登町字柿生地七字",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県鳳珠郡能登町字柿生地七字",
			wantUnmatchedAddress: nil,
		},
		// 大字数字 + 字は util.IsKanjiNumeral の対象外なので別に確認する
		{
			name: "issue290-4 [石川県加賀市横北町元矢田野村大字矢田野字七弐]",
			query: model.MatchQuery{
				Address:  "石川県加賀市横北町元矢田野村大字矢田野字七弐",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県加賀市横北町元矢田野村大字矢田野字七弐",
			wantUnmatchedAddress: nil,
		},
		// 算用数字 + 字も保護される。regression テスト
		{
			name: "issue290-5 [福井県大野市犬山22字] 算用数字+字",
			query: model.MatchQuery{
				Address:  "福井県大野市犬山22字",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "福井県大野市犬山22字",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "福井県",
				FieldCity:    "大野市",
				FieldOazaCho: "犬山",
				FieldKoaza:   "22字",
			},
		},
	})
}
