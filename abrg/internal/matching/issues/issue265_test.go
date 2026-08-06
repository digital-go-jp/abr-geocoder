package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue265 tests that the numeric-koaza fallback respects the request category
// Issue #265: category=rsdtdsp/basic でも数字小字フォールバックが地番(parcel)の結果を返す
// https://github.com/digital-go-jp/abr-geocoder/issues/265
//
// 問題:
//   - 「七尾市大田町111-11」(category=rsdtdsp) → match_level=parcel が返る
//   - 数字小字フォールバック（#259）がカテゴリを見ずに地番解決まで進むため。
//     小字マッチ（machiaza_detail）で止まるべき
func TestIssue265(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// rsdtdsp 指定: 小字止まり、残りの数字は unmatched
		{
			name: "issue265-1 [七尾市大田町111-11 rsdtdsp]",
			query: model.MatchQuery{
				Address:  "七尾市大田町111-11",
				Category: model.CategoryResidential,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県七尾市大田町111",
			wantUnmatchedAddress: []string{"-11"},
			wantStructured: map[string]any{
				FieldPref:    "石川県",
				FieldCity:    "七尾市",
				FieldOazaCho: "大田町",
				FieldKoaza:   "111",
				FieldPrcNum1: nil,
			},
		},
		// basic 指定も同様に小字止まり
		{
			name: "issue265-2 [七尾市大田町111-11 basic]",
			query: model.MatchQuery{
				Address:  "七尾市大田町111-11",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県七尾市大田町111",
			wantUnmatchedAddress: []string{"-11"},
			wantStructured: map[string]any{
				FieldKoaza:   "111",
				FieldPrcNum1: nil,
			},
		},
		// 回帰確認: parcel / all は地番まで解決
		{
			name: "issue265-3 [七尾市大田町111-11 parcel] 回帰",
			query: model.MatchQuery{
				Address:  "七尾市大田町111-11",
				Category: model.CategoryParcel,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel: model.MatchLevelParcel,
			wantStructured: map[string]any{
				FieldKoaza:   "111",
				FieldPrcNum1: "11",
			},
		},
		{
			name: "issue265-4 [七尾市大田町111-11 all] 回帰",
			query: model.MatchQuery{
				Address:  "七尾市大田町111-11",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel: model.MatchLevelParcel,
			wantStructured: map[string]any{
				FieldKoaza:   "111",
				FieldPrcNum1: "11",
			},
		},
	})
}
