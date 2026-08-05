package issues

import (
	"testing"

	"abrg/internal/model"
)

// TestIssue348Kana covers the iroha that stands between a town name and the
// digits, in every kana an address writes it in. ABR registers such an iroha in
// half-width katakana when it belongs to a parcel number and in either kana when
// it names a koaza, so the same address arrives in three spellings and all three
// have to reach the one record ABR holds. A kana that no parcel is registered
// under stays unmatched instead of being answered with the digits alone, which
// name a different parcel.
// https://github.com/digital-go-jp/abr-geocoder/issues/348
func TestIssue348Kana(t *testing.T) {
	query := func(address string) model.MatchQuery {
		return model.MatchQuery{
			Address:  address,
			Category: model.CategoryAll,
			Pref:     "all",
			Limit:    1,
		}
	}

	runNormalizeTests(t, []normalizeTestCase{
		{
			// 成田市 registers the prefix in half-width katakana, and an address
			// that writes it the same way reaches it.
			name:               "issue348-kana-1 [千葉県成田市松子ｾ16番地] half-width katakana prefix",
			query:              query("千葉県成田市松子ｾ16番地"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "千葉県成田市松子セ16",
			wantStructured: map[string]any{
				FieldPref:    "千葉県",
				FieldCity:    "成田市",
				FieldOazaCho: "松子",
				FieldPrcNum1: "セ16",
			},
		},
		{
			// The same parcel, written in hiragana.
			name:               "issue348-kana-2 [千葉県成田市松子せ16番地] hiragana reaches a katakana prefix",
			query:              query("千葉県成田市松子せ16番地"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "千葉県成田市松子セ16",
			wantStructured: map[string]any{
				FieldPref:    "千葉県",
				FieldCity:    "成田市",
				FieldOazaCho: "松子",
				FieldPrcNum1: "セ16",
			},
		},
		{
			// 朝日町 registers its prefixes in hiragana, which is the one kana a
			// search address never holds: the input has had its hiragana turned
			// into katakana before the parcel is looked up.
			name:               "issue348-kana-3 [山形県西村山郡朝日町大字常盤い9番地] hiragana prefix",
			query:              query("山形県西村山郡朝日町大字常盤い9番地"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "山形県西村山郡朝日町大字常盤い9",
			wantStructured: map[string]any{
				FieldPref:    "山形県",
				FieldCounty:  "西村山郡",
				FieldCity:    "朝日町",
				FieldOazaCho: "大字常盤",
				FieldPrcNum1: "い9",
			},
		},
		{
			name:               "issue348-kana-4 [山形県西村山郡朝日町大字常盤イ9番地] katakana reaches a hiragana prefix",
			query:              query("山形県西村山郡朝日町大字常盤イ9番地"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "山形県西村山郡朝日町大字常盤い9",
			wantStructured: map[string]any{
				FieldPref:    "山形県",
				FieldCounty:  "西村山郡",
				FieldCity:    "朝日町",
				FieldOazaCho: "大字常盤",
				FieldPrcNum1: "い9",
			},
		},
		{
			name:               "issue348-kana-5 [山形県西村山郡朝日町大字常盤ｲ9番地] half-width katakana reaches a hiragana prefix",
			query:              query("山形県西村山郡朝日町大字常盤ｲ9番地"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "山形県西村山郡朝日町大字常盤い9",
			wantStructured: map[string]any{
				FieldPref:    "山形県",
				FieldCounty:  "西村山郡",
				FieldCity:    "朝日町",
				FieldOazaCho: "大字常盤",
				FieldPrcNum1: "い9",
			},
		},
		{
			// 坪川 names its koaza with a hiragana iroha, so the kana belongs to
			// the town and the number that follows stands on its own.
			name:               "issue348-kana-6 [石川県鹿島郡中能登町坪川ぬ12番地] hiragana koaza, not a prefix",
			query:              query("石川県鹿島郡中能登町坪川ぬ12番地"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "石川県鹿島郡中能登町坪川ぬ12",
			wantStructured: map[string]any{
				FieldPref:    "石川県",
				FieldCounty:  "鹿島郡",
				FieldCity:    "中能登町",
				FieldOazaCho: "坪川",
				FieldKoaza:   "ぬ",
				FieldPrcNum1: "12",
			},
		},
		{
			name:               "issue348-kana-7 [石川県鹿島郡中能登町坪川ﾇ12番地] half-width katakana reaches a hiragana koaza",
			query:              query("石川県鹿島郡中能登町坪川ﾇ12番地"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "石川県鹿島郡中能登町坪川ぬ12",
			wantStructured: map[string]any{
				FieldPref:    "石川県",
				FieldCounty:  "鹿島郡",
				FieldCity:    "中能登町",
				FieldOazaCho: "坪川",
				FieldKoaza:   "ぬ",
				FieldPrcNum1: "12",
			},
		},
		{
			// 坪川ツ holds no parcel numbered 12, so the digits stay unmatched
			// rather than being answered from a neighbouring koaza.
			name:                 "issue348-kana-8 [石川県鹿島郡中能登町坪川ツ12番地] koaza with no parcel behind the number",
			query:                query("石川県鹿島郡中能登町坪川ツ12番地"),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県鹿島郡中能登町坪川ツ",
			wantUnmatchedAddress: []string{"12"},
			wantStructured: map[string]any{
				FieldPref:    "石川県",
				FieldCounty:  "鹿島郡",
				FieldCity:    "中能登町",
				FieldOazaCho: "坪川",
				FieldKoaza:   "ツ",
			},
		},
		{
			// 紀尾井町 holds no parcel under あ in any kana, and the residential
			// 14 is a different address, so nothing is answered for it.
			name:                 "issue348-kana-9 [東京都千代田区紀尾井町あ14番地] hiragana with no parcel behind it",
			query:                query("東京都千代田区紀尾井町あ14番地"),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "東京都千代田区紀尾井町",
			wantUnmatchedAddress: []string{"あ14"},
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "千代田区",
				FieldOazaCho: "紀尾井町",
			},
		},
	})
}
