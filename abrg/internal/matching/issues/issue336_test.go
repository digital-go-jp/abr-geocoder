package issues

import (
	"testing"

	"abrg/internal/model"
)

// TestIssue336 covers the boundary between a town name and the address number
// when a katakana sits on either side of it: a town whose name ends in one, a
// parcel number prefixed by one, and a town name that holds a katakana run.
// https://github.com/digital-go-jp/abr-geocoder/issues/336
func TestIssue336(t *testing.T) {
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
			// 公団アパ―ト is the registered town name; the ― becomes a hyphen under
			// dash normalization, which must not read アパ as an address number.
			name:               "issue336-1 [宮城県仙台市宮城野区小田原幸町公団アパ―ト] katakana run in the town name",
			query:              query("宮城県仙台市宮城野区小田原幸町公団アパ―ト"),
			wantMatchLevel:     model.MatchLevelMachiaza,
			wantMatchedAddress: "宮城県仙台市宮城野区小田原幸町公団アパ―ト",
			wantStructured: map[string]any{
				FieldPref:    "宮城県",
				FieldCity:    "仙台市",
				FieldWard:    "宮城野区",
				FieldOazaCho: "小田原幸町公団アパ―ト",
			},
		},
		{
			// The town name ends in a katakana, so the number starts after it.
			name:               "issue336-2 [三重県多気郡大台町長ケ1317番地] town name ending in katakana",
			query:              query("三重県多気郡大台町長ケ1317番地"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "三重県多気郡大台町長ケ1317",
			wantStructured: map[string]any{
				FieldPref:    "三重県",
				FieldCounty:  "多気郡",
				FieldCity:    "大台町",
				FieldOazaCho: "長ケ",
				FieldPrcNum1: "1317",
			},
		},
		{
			// ABR records an iroha parcel prefix in half-width katakana, and the
			// result widens it so one address does not mix the two forms.
			name:               "issue336-3 [千葉県成田市松子セ16番地] iroha parcel prefix",
			query:              query("千葉県成田市松子セ16番地"),
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
			// Here the katakana is the whole koaza, and the parcel is the digits.
			name:               "issue336-4 [石川県七尾市柑子町チ1番地] katakana koaza",
			query:              query("石川県七尾市柑子町チ1番地"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "石川県七尾市柑子町チ1",
			wantStructured: map[string]any{
				FieldPref:    "石川県",
				FieldCity:    "七尾市",
				FieldOazaCho: "柑子町",
				FieldPrcNum1: "1",
			},
		},
		{
			// 紀尾井町 holds no parcel numbered ア14, so the ア is left unmatched
			// rather than answered with 14, which is a different parcel.
			name:                 "issue336-5 [東京都千代田区紀尾井町ア14番地] katakana with no parcel behind it",
			query:                query("東京都千代田区紀尾井町ア14番地"),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "東京都千代田区紀尾井町",
			wantUnmatchedAddress: []string{"ア14"},
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "千代田区",
				FieldOazaCho: "紀尾井町",
			},
		},
		{
			// Digits after the first number are a room number, and the katakana in
			// front of them ends a building name (大通り becomes 大通リ).
			name:               "issue336-6 [北海道札幌市中央区大通東3丁目1クリーンリバー大通り506] katakana before a room number",
			query:              query("北海道札幌市中央区大通東3丁目1クリーンリバー大通り506"),
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "北海道札幌市中央区大通東3丁目",
			wantStructured: map[string]any{
				FieldPref:    "北海道",
				FieldCity:    "札幌市",
				FieldWard:    "中央区",
				FieldOazaCho: "大通東",
				FieldChome:   "3丁目",
			},
		},
	})
}
