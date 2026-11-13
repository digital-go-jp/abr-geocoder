package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue365 covers a town name matched fuzzily, followed by a lot number
// with no chome written.
// The lot number is not taken as a chome and stays in unmatched_address.
// A leading number that names one of the town's chome is still taken as it,
// as an exact town name does.
// Issue #365: 丁目を書かない住所で番地の数字が丁目に化け、未マッチが空になる
// https://github.com/digital-go-jp/abr-geocoder/issues/365
func TestIssue365(t *testing.T) {
	query := func(address string) model.MatchQuery {
		return model.MatchQuery{
			Address:  address,
			Category: model.CategoryAll,
			Pref:     "all",
			Limit:    1,
		}
	}
	noChome := func(address string) normalizeTestCase {
		return normalizeTestCase{
			name:                 "issue365 [" + address + "] lot number is not a chome",
			query:                query(address),
			wantUnmatchedAddress: []string{},
			wantStructured:       map[string]any{FieldChome: nil},
		}
	}

	tests := []normalizeTestCase{
		noChome("神奈川県川崎市幸区鹿島田1004番地"),
		noChome("熊本県熊本市西区二本木126番地"),
		noChome("熊本県熊本市西区二本木26番地"),
		noChome("熊本県熊本市西区二本木6番地"),
		noChome("東京都新宿区西新宿826番地"),
		noChome("熊本県熊本市西区二本木町126番地"),
		noChome("佐賀県唐津市大字唐津515番地"),
		noChome("東京都千代田区神田旭町14番地"),
		noChome("千葉県市川市市川町3241番地"),
		{
			// The leading 2 names a chome of 西新宿, as in 西新宿2-8-1.
			name:                 "issue365 [東京都新宿区西親宿2-8-1] chome before a hyphen",
			query:                query("東京都新宿区西親宿2-8-1"),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都新宿区西新宿2丁目",
			wantUnmatchedAddress: []string{"8-1"},
		},
		{
			// A single number that names a chome is taken as it, as 西新宿2 is.
			name:               "issue365 [東京都新宿区西親宿2] single number naming a chome",
			query:              query("東京都新宿区西親宿2"),
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "東京都新宿区西新宿2丁目",
		},
	}
	runNormalizeTests(t, tests)
}
