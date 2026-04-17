package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue157 tests building floor number parsing
// Issue #157: 住居表示の番号の階数表記の解析不具合
// https://github.com/digital-go-jp/abr-geocoder/issues/157

func TestIssue157(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Fixed: chome=1丁目 correctly extracted, parcel=5
			name: "issue157-1 [札幌市中央区南２条西１ー５ー２F]",
			query: model.MatchQuery{
				Address:  "札幌市中央区南２条西１ー５ー２F",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "北海道札幌市中央区南2条西1丁目5",
			wantUnmatchedAddress: []string{"-2F"},
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       nil,
				FieldCity:         "札幌市",
				FieldWard:         "中央区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "南2条西",
				FieldChome:        "1丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "5",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 全角数字・全角アルファベット
		{
			name: "issue157-2 [札幌市中央区南２条西１ー５ー２Ｆ]",
			query: model.MatchQuery{
				Address:  "札幌市中央区南２条西１ー５ー２Ｆ",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "北海道札幌市中央区南2条西1丁目5",
			wantUnmatchedAddress: []string{"-2F"},
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       nil,
				FieldCity:         "札幌市",
				FieldWard:         "中央区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "南2条西",
				FieldChome:        "1丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "5",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 半角ハイフン
		{
			name: "issue157-3 [札幌市中央区南2条西1-5-2F]",
			query: model.MatchQuery{
				Address:  "札幌市中央区南2条西1-5-2F",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "北海道札幌市中央区南2条西1丁目5",
			wantUnmatchedAddress: []string{"-2F"},
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       nil,
				FieldCity:         "札幌市",
				FieldWard:         "中央区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "南2条西",
				FieldChome:        "1丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "5",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 「階」表記
		{
			name: "issue157-4 [札幌市中央区南2条西1-5-2階]",
			query: model.MatchQuery{
				Address:  "札幌市中央区南2条西1-5-2階",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "北海道札幌市中央区南2条西1丁目5",
			wantUnmatchedAddress: []string{"-2階"},
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       nil,
				FieldCity:         "札幌市",
				FieldWard:         "中央区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "南2条西",
				FieldChome:        "1丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "5",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
	})
}
