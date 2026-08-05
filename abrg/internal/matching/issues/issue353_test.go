package issues

import (
	"testing"

	"abrg/internal/model"
)

// TestIssue353 covers parcel numbers whose branch is an iroha rather than
// digits. ABR keeps such a branch in prc_num2 or prc_num3, and an address
// writes it after the number separator, so the search has to carry it through
// instead of stopping at the last part that starts with a digit.
// https://github.com/digital-go-jp/abr-geocoder/issues/353
func TestIssue353(t *testing.T) {
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
			name:               "issue353-1 [北海道岩内郡共和町南幌似6番地ロ] katakana branch written after 番地",
			query:              query("北海道岩内郡共和町南幌似6番地ロ"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "北海道岩内郡共和町南幌似6-ロ",
			wantStructured: map[string]any{
				FieldPref:    "北海道",
				FieldCounty:  "岩内郡",
				FieldCity:    "共和町",
				FieldOazaCho: "南幌似",
				FieldPrcNum1: "6",
				FieldPrcNum2: "ロ",
			},
		},
		{
			name:               "issue353-2 [北海道岩内郡共和町南幌似6-ロ] katakana branch written after a hyphen",
			query:              query("北海道岩内郡共和町南幌似6-ロ"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "北海道岩内郡共和町南幌似6-ロ",
			wantStructured: map[string]any{
				FieldPref:    "北海道",
				FieldCounty:  "岩内郡",
				FieldCity:    "共和町",
				FieldOazaCho: "南幌似",
				FieldPrcNum1: "6",
				FieldPrcNum2: "ロ",
			},
		},
		{
			// 大子町 registers the branch in hiragana.
			name:               "issue353-3 [茨城県久慈郡大子町大字上岡193番地ろ] hiragana branch",
			query:              query("茨城県久慈郡大子町大字上岡193番地ろ"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "茨城県久慈郡大子町大字上岡193-ろ",
			wantStructured: map[string]any{
				FieldPref:    "茨城県",
				FieldCounty:  "久慈郡",
				FieldCity:    "大子町",
				FieldOazaCho: "大字上岡",
				FieldPrcNum1: "193",
				FieldPrcNum2: "ろ",
			},
		},
		{
			// The same branch written in katakana, which is the form a search
			// address always holds.
			name:               "issue353-4 [茨城県久慈郡大子町大字上岡193番地ロ] katakana reaches a hiragana branch",
			query:              query("茨城県久慈郡大子町大字上岡193番地ロ"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "茨城県久慈郡大子町大字上岡193-ろ",
			wantStructured: map[string]any{
				FieldPref:    "茨城県",
				FieldCounty:  "久慈郡",
				FieldCity:    "大子町",
				FieldOazaCho: "大字上岡",
				FieldPrcNum1: "193",
				FieldPrcNum2: "ろ",
			},
		},
		{
			// 楠久 registers 360 with the branches 1, 2 and 3 but none in kana,
			// so the ロ stays unmatched rather than being answered with 360,
			// which is a different parcel.
			name:                 "issue353-5 [佐賀県伊万里市山代町楠久360番地ロ] branch with no parcel behind it",
			query:                query("佐賀県伊万里市山代町楠久360番地ロ"),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "佐賀県伊万里市山代町楠久",
			wantUnmatchedAddress: []string{"360-ロ"},
			wantStructured: map[string]any{
				FieldPref:    "佐賀県",
				FieldCity:    "伊万里市",
				FieldOazaCho: "山代町楠久",
			},
		},
		{
			// A kana run after 番地 opens a building name, not a branch number.
			name:               "issue353-6 [福島県伊達市霊山町石田字中後坂19番地イ] branch registered under the koaza",
			query:              query("福島県伊達市霊山町石田字中後坂19番地イ"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "福島県伊達市霊山町石田字中後坂19-イ",
			wantStructured: map[string]any{
				FieldPref:    "福島県",
				FieldCity:    "伊達市",
				FieldOazaCho: "霊山町石田",
				FieldKoaza:   "字中後坂",
				FieldPrcNum1: "19",
				FieldPrcNum2: "イ",
			},
		},
	})
}
