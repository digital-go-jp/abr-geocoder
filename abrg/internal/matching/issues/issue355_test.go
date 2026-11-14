package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue355 covers a town name with one character mistyped, matched
// fuzzily and then resolved down to its number.
// The town is compared in the form the search address holds it, without 大字
// and with numerals converted, so a town registered with 大字 still counts as a
// one-character typo.
// Issue #355: 町字名との突き合わせが正規化前の文字列を見ている箇所がある
// https://github.com/digital-go-jp/abr-geocoder/issues/355
func TestIssue355(t *testing.T) {
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
			// lg_code=122203 machiaza_id=0025000 is 大字深井新田.
			name:                 "issue355-1 [千葉県流山市大字深井親田1番地] town registered with 大字",
			query:                query("千葉県流山市大字深井親田1番地"),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "千葉県流山市大字深井新田1",
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldOazaCho: "大字深井新田", FieldPrcNum1: "1"},
		},
		{
			name:                 "issue355-2 [千葉県流山市深井親田1番地] input without 大字",
			query:                query("千葉県流山市深井親田1番地"),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "千葉県流山市大字深井新田1",
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldOazaCho: "大字深井新田", FieldPrcNum1: "1"},
		},
		{
			// The chome is written, so the chome of the match is the input's own.
			// The result is that of 西新宿二丁目8-1 spelled correctly.
			name:                 "issue355-3 [東京都新宿区西親宿二丁目8-1] chome written",
			query:                query("東京都新宿区西親宿二丁目8-1"),
			wantMatchLevel:       model.MatchLevelResidentialBlock,
			wantMatchedAddress:   "東京都新宿区西新宿2丁目8",
			wantUnmatchedAddress: []string{"-1"},
			wantStructured:       map[string]any{FieldOazaCho: "西新宿", FieldChome: "2丁目", FieldBlkNum: "8"},
		},
		{
			// A number left before the number section belongs to a building
			// (光栄荘8), so the last number is not searched as a lot.
			name:                 "issue355-5 [愛知県名古屋市港区東土古町１丁目１光栄荘８] number inside a building name",
			query:                query("愛知県名古屋市港区東土古町１丁目１光栄荘８"),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantUnmatchedAddress: []string{"1光栄荘8"},
			wantStructured:       map[string]any{FieldPrcNum1: nil, FieldBlkNum: nil},
		},
		{
			// 番地 left unconverted before a floor keeps the lot number out of
			// the number section.
			name:                 "issue355-6 [埼玉県さいたま市大宮区北袋町１丁目６０１番地２－Ｆ１０６９] 番地 left",
			query:                query("埼玉県さいたま市大宮区北袋町１丁目６０１番地２－Ｆ１０６９"),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantUnmatchedAddress: []string{"601番地2-F1069"},
			wantStructured:       map[string]any{FieldPrcNum1: nil, FieldBlkNum: nil},
		},
		{
			// No chome is written, so 1丁目 came from the lot number and the
			// number is not searched in it.
			name:                 "issue355-4 [熊本県熊本市西区二本木137番地] chome not written",
			query:                query("熊本県熊本市西区二本木137番地"),
			wantUnmatchedAddress: []string{},
			wantStructured:       map[string]any{FieldPrcNum1: nil, FieldBlkNum: nil},
		},
	})
}
