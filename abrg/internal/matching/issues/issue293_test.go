package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue293 tests that trailing digits belonging to a koaza name are not reported as unmatched.
// Issue #293: 小字名が漢数字で終わる住所で、完全一致でも数字がアンマッチとして返る
// https://github.com/digital-go-jp/abr-geocoder/issues/293
//
// 問題:
//   - 「字女形二」のような小字は正規化で末尾が算用数字になり、その数字が地番として切り出される
//   - 切り出した数字が小字名の一部かどうかを判定する matchesPlaceName は、
//     小字名の全体を数字に変換したものと等値比較していた
//   - 小字名の全体が数字の「壱九」は成立するが、名前の一部が数字の「字女形二」は
//     「女形2 != 2」で不成立になり、数字がアンマッチとして残る
//
// 解決:
// - 小字名の末尾から来た数字も小字名の一部として扱う
func TestIssue293(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// 小字名の一部が漢数字
		{
			name: "issue293-1 [宮城県石巻市広渕字女形二]",
			query: model.MatchQuery{
				Address:  "宮城県石巻市広渕字女形二",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "宮城県石巻市広渕字女形二",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "宮城県",
				FieldCity:    "石巻市",
				FieldOazaCho: "広渕",
				FieldKoaza:   "字女形二",
			},
		},
		{
			name: "issue293-2 [宮城県石巻市北村字下田三]",
			query: model.MatchQuery{
				Address:  "宮城県石巻市北村字下田三",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "宮城県石巻市北村字下田三",
			wantUnmatchedAddress: nil,
		},
		{
			name: "issue293-3 [福島県伊達郡国見町大字藤田字沖ノ一]",
			query: model.MatchQuery{
				Address:  "福島県伊達郡国見町大字藤田字沖ノ一",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "福島県伊達郡国見町大字藤田字沖ノ一",
			wantUnmatchedAddress: nil,
		},
		{
			name: "issue293-4 [宮城県柴田郡村田町大字沼辺字東小沼二]",
			query: model.MatchQuery{
				Address:  "宮城県柴田郡村田町大字沼辺字東小沼二",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "宮城県柴田郡村田町大字沼辺字東小沼二",
			wantUnmatchedAddress: nil,
		},
		// 小字名の全体が大字数字。元から成立していた。regression テスト
		{
			name: "issue293-5 [石川県七尾市能登島祖母ヶ浦町壱九] 小字全体が数字",
			query: model.MatchQuery{
				Address:  "石川県七尾市能登島祖母ヶ浦町壱九",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県七尾市能登島祖母ヶ浦町壱九",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "石川県",
				FieldCity:    "七尾市",
				FieldOazaCho: "能登島祖母ヶ浦町",
				FieldKoaza:   "壱九",
			},
		},
		{
			name: "issue293-6 [石川県七尾市能登島鰀目町参八] 小字全体が数字",
			query: model.MatchQuery{
				Address:  "石川県七尾市能登島鰀目町参八",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県七尾市能登島鰀目町参八",
			wantUnmatchedAddress: nil,
		},
	})
}
