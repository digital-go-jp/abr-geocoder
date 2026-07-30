package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue247 covers addresses whose prefecture is omitted and whose city name
// is misspelled, so neither a prefecture code nor an lg_code is detected. The
// city name still scopes the fuzzy search to its nearest cities instead of the
// whole machiaza table, which both bounds the query and keeps the result equal
// to the one the correctly spelled address returns.
// https://github.com/digital-go-jp/abr-geocoder/issues/247
func TestIssue247(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 巿 (U+5DFF) は市 (U+5E02) の異体字で、正規化表にない。
			name: "issue247-1 [横浜巿西区みなとみらい] misspelled city",
			query: model.MatchQuery{
				Address:  "横浜巿西区みなとみらい",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "神奈川県横浜市西区みなとみらい一丁目",
			// 正しく「横浜市」と書いた場合と同じ結果になる。
			wantUnmatchedAddress: []string{"ミナトミライ"},
			wantStructured: map[string]any{
				FieldPref: "神奈川県",
				FieldCity: "横浜市",
				FieldWard: "西区",
			},
		},
		{
			// 宇左市 は 宇土市・宇城市 の方が編集距離が近いが、
			// 町字まで含めた距離で 宇佐市 が選ばれる。
			name: "issue247-2 [宇左市安心院町古川] nearer city is not the right one",
			query: model.MatchQuery{
				Address:  "宇左市安心院町古川",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiaza,
			wantMatchedAddress: "大分県宇佐市安心院町古川",
			wantStructured: map[string]any{
				FieldPref:    "大分県",
				FieldCity:    "宇佐市",
				FieldOazaCho: "安心院町古川",
			},
		},
		{
			// 中区は2024年に中央区へ統合された。旧区名からでも届く。
			name: "issue247-3 [浜松巿中区板屋町] misspelled city with an old ward name",
			query: model.MatchQuery{
				Address:  "浜松巿中区板屋町",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiaza,
			wantMatchedAddress: "静岡県浜松市中央区板屋町",
			wantStructured: map[string]any{
				FieldPref: "静岡県",
				FieldCity: "浜松市",
				FieldWard: "中央区",
			},
		},
		{
			// 市区町村を名乗らない入力は照合対象が決まらないので unknown を返す。
			// 全件スキャンに落ちていた入力で、バッチではこれが queryTimeout を超えていた。
			name: "issue247-4 [ニューヨークシティマンハッタンフィフスアベニュー350] no city in the address",
			query: model.MatchQuery{
				Address:  "ニューヨークシティマンハッタンフィフスアベニュー350",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelUnknown,
			wantUnmatchedAddress: []string{"ニューヨークシティマンハッタンフィフスアベニュー350"},
		},
		{
			// 市区町村名を名乗るが実在しない入力も、候補市区町村が尽きて unknown になる。
			name: "issue247-5 [ヨクワカラナイ市不明町字テスト12番地] city that does not exist",
			query: model.MatchQuery{
				Address:  "ヨクワカラナイ市不明町字テスト12番地",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelUnknown,
			wantUnmatchedAddress: []string{"ヨクワカラナイ市不明町字テスト12"},
		},
	})
}
