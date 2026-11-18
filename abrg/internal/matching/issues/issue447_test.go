package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue447 covers same-named machiaza spelled differently, where the one
// closest to the input spelling holds no parcels and the other holds the lot.
// lg_code=262064 has 西別院町万願寺 大堂 (machiaza_id=0085107, no parcels) and
// 西別院町萬願寺 大堂 (machiaza_id=0137115, holds 1-4).
// lg_code=281115 has 神出町広谷 (machiaza_id=0122000, no parcels) and
// 神出町廣谷 (machiaza_id=0126000, holds 165-162).
// lg_code=043621 has 高瀬 字竹ノ内原 (machiaza_id=0006179, no parcels) and
// 高瀬 字竹の内原 (machiaza_id=0006132, holds 16).
// The candidate holding the lot is chosen.
// lg_code=172031 has 月津町 ツ (machiaza_id=0131115, 2 parcels) and 月津町 つ
// (machiaza_id=0131116, holds 48). Both hold parcels and are separate areas,
// so the spelling of the input decides.
// Issue #447: 異体字などで表記が異なる同名の町字で、地番数 0 の町字を選択する
// https://github.com/digital-go-jp/abr-geocoder/issues/447
func TestIssue447(t *testing.T) {
	query := func(address string, category model.Category) model.MatchQuery {
		return model.MatchQuery{Address: address, Category: category, Pref: "all", Limit: 1}
	}

	runNormalizeTests(t, []normalizeTestCase{
		{
			name:                 "issue447-1 [京都府亀岡市西別院町万願寺大堂１番地の４] all",
			query:                query("京都府亀岡市西別院町万願寺大堂１番地の４", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "京都府亀岡市西別院町萬願寺大堂1-4",
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldOazaCho: "西別院町萬願寺", FieldKoaza: "大堂", FieldPrcNum1: "1", FieldPrcNum2: "4"},
		},
		{
			name:                 "issue447-2 [京都府亀岡市西別院町万願寺大堂１番地の４] basic",
			query:                query("京都府亀岡市西別院町万願寺大堂１番地の４", model.CategoryBasic),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "京都府亀岡市西別院町萬願寺大堂",
			wantUnmatchedAddress: []string{"1-4"},
			wantStructured:       map[string]any{FieldOazaCho: "西別院町萬願寺", FieldKoaza: "大堂"},
		},
		{
			name:                 "issue447-3 [兵庫県神戸市西区神出町広谷１６５－１６２] all",
			query:                query("兵庫県神戸市西区神出町広谷１６５－１６２", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "兵庫県神戸市西区神出町廣谷165-162",
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldOazaCho: "神出町廣谷", FieldPrcNum1: "165", FieldPrcNum2: "162"},
		},
		{
			name:                 "issue447-4 [宮城県亘理郡山元町高瀬字竹ノ内原１６番地] all",
			query:                query("宮城県亘理郡山元町高瀬字竹ノ内原１６番地", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "宮城県亘理郡山元町高瀬字竹の内原16",
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldOazaCho: "高瀬", FieldKoaza: "字竹の内原", FieldPrcNum1: "16"},
		},
		{
			name:                 "issue447-5 [石川県小松市月津町ツ４８番地] all",
			query:                query("石川県小松市月津町ツ４８番地", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県小松市月津町ツ",
			wantUnmatchedAddress: []string{"48"},
			wantStructured:       map[string]any{FieldOazaCho: "月津町", FieldKoaza: "ツ"},
		},
	})
}
