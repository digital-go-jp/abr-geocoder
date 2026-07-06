package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue244 verifies 番地 conversion with a hyphenated edaban (枝番).
// Issue #244: 「番地」+ハイフン枝番で「番地」が変換されず残る
//
// 問題:
//   - 「N番地M-P」「N番地-M」で番地が未変換のまま残っていた
//     (玉川4丁目4番地1-999号 → 番地残、4番地-11 → 4--11 の二重ハイフン)
//   - 番側 (banWithHyphenNumeric/banHyphen) に対応する番地版が無かった
//
// 解決:
//   - banchiWithHyphenNumeric ((\d+)番地(\d+)(-\d+)) と banchiHyphen ((\d+)番地-(\d+)) を追加
func TestIssue244(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue244-1 [東京都世田谷区玉川４丁目４番地１－９９９号] 番地M-P",
			query: model.MatchQuery{
				Address:  "東京都世田谷区玉川４丁目４番地１－９９９号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都世田谷区玉川4丁目4-1",
			wantUnmatchedAddress: []string{"-999"},
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "世田谷区",
				FieldOazaCho: "玉川",
				FieldChome:   "4丁目",
				FieldBlkNum:  "4",
				FieldRsdtNum: "1",
			},
		},
		{
			name: "issue244-2 [東京都世田谷区玉川４丁目４番地－１１] 番地-M",
			query: model.MatchQuery{
				Address:  "東京都世田谷区玉川４丁目４番地－１１",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都世田谷区玉川4丁目",
			wantUnmatchedAddress: []string{"4-11"},
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "世田谷区",
				FieldOazaCho: "玉川",
				FieldChome:   "4丁目",
			},
		},
	})
}
