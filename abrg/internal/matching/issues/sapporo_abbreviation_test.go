package issues

import (
	"testing"

	"abrg/internal/model"
)

// TestSapporoAbbreviation covers the Sapporo grid written without 条, where
// 北3西20 stands for 北3条西20丁目. Whichever boundary the writer used — the
// hyphen the abbreviation puts in place of 丁目, a 丁目 they kept, or kanji
// numerals throughout — the address must reach the residential level, the
// same as the spelled-out form.
//
// The 条-bearing forms are covered by TestIssue157, TestIssue188 and
// TestIssue262; those never reach the expansion.
func TestSapporoAbbreviation(t *testing.T) {
	// lg_code 011011 / machiaza_id 0020020 = 北海道札幌市中央区北3条西20丁目.
	structured := map[string]any{
		FieldPref:         "北海道",
		FieldCounty:       nil,
		FieldCity:         "札幌市",
		FieldWard:         "中央区",
		FieldMachiazaDist: nil,
		FieldKyotoSt:      nil,
		FieldOazaCho:      "北3条西",
		FieldChome:        "20丁目",
		FieldKoaza:        nil,
		FieldBlkNum:       "1",
		FieldRsdtNum:      "1",
		FieldRsdtNum2:     nil,
		FieldPrcNum1:      nil,
		FieldPrcNum2:      nil,
		FieldPrcNum3:      nil,
	}
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
			// The hyphen is the chome boundary, not a separator between two
			// block numbers.
			name:                 "sapporo-abbrev-1 [北海道札幌市中央区北3西20-1-1]",
			query:                query("北海道札幌市中央区北3西20-1-1"),
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "北海道札幌市中央区北3条西20丁目1-1",
			wantUnmatchedAddress: nil,
			wantStructured:       structured,
		},
		{
			// 条 omitted but 丁目 kept: the expansion must not add a second one.
			name:                 "sapporo-abbrev-2 [北海道札幌市中央区北3西20丁目1-1]",
			query:                query("北海道札幌市中央区北3西20丁目1-1"),
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "北海道札幌市中央区北3条西20丁目1-1",
			wantUnmatchedAddress: nil,
			wantStructured:       structured,
		},
		{
			// Kanji numerals take a different route: AddColon runs before
			// KanjiToArabic, so it sees no digits to expand and marks the
			// boundary itself.
			name:                 "sapporo-abbrev-3 [北海道札幌市中央区北三西二〇-1-1]",
			query:                query("北海道札幌市中央区北三西二〇-1-1"),
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "北海道札幌市中央区北3条西20丁目1-1",
			wantUnmatchedAddress: nil,
			wantStructured:       structured,
		},
		{
			name:                 "sapporo-abbrev-4 [北海道札幌市中央区北3条西20丁目1-1]",
			query:                query("北海道札幌市中央区北3条西20丁目1-1"),
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "北海道札幌市中央区北3条西20丁目1-1",
			wantUnmatchedAddress: nil,
			wantStructured:       structured,
		},
	})
}
