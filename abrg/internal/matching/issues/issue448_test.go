package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue448 covers same-named machiaza, with and without 大字, that both
// hold the input prc_num1 while only one holds the input prc_num2 as well.
// lg_code=132241 has 大字貝取 (machiaza_id=0030000, holds 1450 but not 1450-1)
// and 貝取 (machiaza_id=0009000, holds 1450-1).
// lg_code=203211 has 大字軽井沢 (machiaza_id=0002000, holds 1 but not 1-1)
// and 軽井沢 (machiaza_id=0007000, holds 1-1).
// lg_code=052019 has 寺内神屋敷 (machiaza_id=0224000, holds 295 but not
// 295-48) and 寺内字神屋敷 (machiaza_id=0218110, holds 295-48).
// The candidate holding the whole lot is chosen.
// Issue #448: 地番の本番が両方の町字に所属すると、枝番まで一致する地番が所属しない町字を選択する
// https://github.com/digital-go-jp/abr-geocoder/issues/448
func TestIssue448(t *testing.T) {
	query := func(address string, category model.Category) model.MatchQuery {
		return model.MatchQuery{Address: address, Category: category, Pref: "all", Limit: 1}
	}

	runNormalizeTests(t, []normalizeTestCase{
		{
			name:                 "issue448-1 [東京都多摩市貝取１４５０番地１] all",
			query:                query("東京都多摩市貝取１４５０番地１", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "東京都多摩市貝取1450-1",
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldOazaCho: "貝取", FieldPrcNum1: "1450", FieldPrcNum2: "1"},
		},
		{
			name:                 "issue448-2 [東京都多摩市貝取１４５０番地１] basic",
			query:                query("東京都多摩市貝取１４５０番地１", model.CategoryBasic),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "東京都多摩市貝取",
			wantUnmatchedAddress: []string{"1450-1"},
			wantStructured:       map[string]any{FieldOazaCho: "貝取"},
		},
		{
			name:                 "issue448-3 [長野県北佐久郡軽井沢町軽井沢１番地１] all",
			query:                query("長野県北佐久郡軽井沢町軽井沢１番地１", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "長野県北佐久郡軽井沢町軽井沢1-1",
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldOazaCho: "軽井沢", FieldPrcNum1: "1", FieldPrcNum2: "1"},
		},
		{
			name:                 "issue448-4 [秋田県秋田市寺内字神屋敷２９５番地の４８] all",
			query:                query("秋田県秋田市寺内字神屋敷２９５番地の４８", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "秋田県秋田市寺内字神屋敷295-48",
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldOazaCho: "寺内", FieldKoaza: "字神屋敷", FieldPrcNum1: "295", FieldPrcNum2: "48"},
		},
	})
}
