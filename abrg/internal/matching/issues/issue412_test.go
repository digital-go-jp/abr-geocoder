package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue412 covers N番M followed directly by a building name.
// The number is matched and the building name is left in unmatched_address.
// Issue #412: 新ABRで建物名を含む住所の認識に失敗し city レベルで停止する
// https://github.com/digital-go-jp/abr-geocoder/issues/412
func TestIssue412(t *testing.T) {
	query := func(address string, category model.Category) model.MatchQuery {
		return model.MatchQuery{
			Address:  address,
			Category: category,
			Pref:     "all",
			Limit:    1,
		}
	}
	okusawa := map[string]any{
		FieldPref:    "東京都",
		FieldCity:    "世田谷区",
		FieldOazaCho: "奥沢",
		FieldChome:   "5丁目",
	}
	okusawa714 := map[string]any{
		FieldOazaCho: "奥沢",
		FieldChome:   "5丁目",
		FieldBlkNum:  "7",
		FieldRsdtNum: "14",
	}

	runNormalizeTests(t, []normalizeTestCase{
		{
			// The building name ends in 号, which once made the address look
			// like N番M号 and left 番 unconverted.
			name:                 "issue412-1 [東京都世田谷区奥沢五丁目７番１４自由ヶ丘第２コーポ３０３号] basic",
			query:                query("東京都世田谷区奥沢五丁目７番１４自由ヶ丘第２コーポ３０３号", model.CategoryBasic),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都世田谷区奥沢5丁目",
			wantUnmatchedAddress: []string{"7-14", "自由ヶ丘第2コーポ303号"},
			wantStructured:       okusawa,
		},
		{
			name:                 "issue412-2 [東京都世田谷区奥沢五丁目７番１４自由ヶ丘第２コーポ３０３号] all",
			query:                query("東京都世田谷区奥沢五丁目７番１４自由ヶ丘第２コーポ３０３号", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都世田谷区奥沢5丁目7-14",
			wantUnmatchedAddress: []string{"自由ヶ丘第2コーポ303号"},
			wantStructured:       okusawa714,
		},
		{
			// A branch number before the building name.
			name:                 "issue412-3 [東京都世田谷区奥沢五丁目７番１４－１コーポ３０３号] basic",
			query:                query("東京都世田谷区奥沢五丁目７番１４－１コーポ３０３号", model.CategoryBasic),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都世田谷区奥沢5丁目",
			wantUnmatchedAddress: []string{"7-14-1", "コーポ303号"},
			wantStructured:       okusawa,
		},
		{
			// A building name holding a numbered 棟 once made the address look like N番M棟.
			name:                 "issue412-4 [東京都世田谷区奥沢五丁目７番１４コーポ３棟３０３号] all",
			query:                query("東京都世田谷区奥沢五丁目７番１４コーポ３棟３０３号", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都世田谷区奥沢5丁目7-14",
			wantUnmatchedAddress: []string{"コーポ3棟303号"},
			wantStructured:       okusawa714,
		},
		{
			// 9室 is a room number, not a building name, so 9 stays with it
			// instead of being matched as part of the address.
			name:                 "issue412-5 [山形県鶴岡市新形町７番２０－９室] room number",
			query:                query("山形県鶴岡市新形町７番２０－９室", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "山形県鶴岡市新形町7-20",
			wantUnmatchedAddress: []string{"-9室"},
			wantStructured: map[string]any{
				FieldOazaCho:  "新形町",
				FieldBlkNum:   "7",
				FieldRsdtNum:  "20",
				FieldRsdtNum2: nil,
			},
		},
	})
}
