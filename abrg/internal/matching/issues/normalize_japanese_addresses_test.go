package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestNormalizeJapaneseAddresses tests address normalization cases from
// geolonia/normalize-japanese-addresses issues.
// Reference: https://github.com/geolonia/normalize-japanese-addresses/issues
//
// Note: Do NOT create issues or comments on the original repository.
// This file is for reference and testing purposes only.

// TestNJA023 tests nested town names (栗沢町万字寿町)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/23
func TestNJA023(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "栗沢町万字寿町" is oaza_cho in Iwamizawa city
			name: "nja023-1 [北海道岩見沢市栗沢町万字寿町1-2]",
			query: model.MatchQuery{
				Address:  "北海道岩見沢市栗沢町万字寿町1-2",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "北海道",
				"county":        nil,
				"city":          "岩見沢市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "栗沢町万字寿町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      "1",
				"prc_num2":      "2",
				"prc_num3":      nil,
			},
		},
		{
			// Note: "栗沢町万字西原町" is another variant
			name: "nja023-1a [北海道岩見沢市栗沢町万字西原町]",
			query: model.MatchQuery{
				Address:  "北海道岩見沢市栗沢町万字西原町",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "北海道",
				"county":        nil,
				"city":          "岩見沢市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "栗沢町万字西原町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA024 tests hiragana city/town names (せたな町)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/24
func TestNJA024(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "せたな町" is city name, "北檜山区北檜山" is oaza_cho
			name: "nja024-1 [北海道久遠郡せたな町北檜山区北檜山193]",
			query: model.MatchQuery{
				Address:  "北海道久遠郡せたな町北檜山区北檜山193",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "北海道久遠郡せたな町北檜山区北檜山",
			wantUnmatchedAddress: []string{"193"},
			wantStructured: map[string]any{
				"pref":          "北海道",
				"county":        "久遠郡",
				"city":          "せたな町",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "北檜山区北檜山",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA025 tests Kyoto-style addresses with street names (通り名)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/25
func TestNJA025(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: Kyoto address with toori-mei (street name): "錦小路通大宮東入七軒町"
			// DB has oaza_cho="七軒町" with koaza="錦小路通大宮東入"
			name: "nja025-1 [京都府京都市中京区錦小路通大宮東入七軒町466]",
			query: model.MatchQuery{
				Address:  "京都府京都市中京区錦小路通大宮東入七軒町466",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "京都府",
				"county":        nil,
				"city":          "京都市",
				"ward":          "中京区",
				"machiaza_dist": nil,
				"kyoto_st":      "錦小路通大宮東入",
				"oaza_cho":      "七軒町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      "466",
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA026 tests town names with numeral+軒 pattern (七軒町)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/26
func TestNJA026(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "七軒町" exists in Sano city (different from Kyoto)
			name: "nja026-1 [栃木県佐野市七軒町2201]",
			query: model.MatchQuery{
				Address:  "栃木県佐野市七軒町2201",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "栃木県佐野市七軒町",
			wantUnmatchedAddress: []string{"2201"},
			wantStructured: map[string]any{
				"pref":          "栃木県",
				"county":        nil,
				"city":          "佐野市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "七軒町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA031 tests addresses where town name appears in city name (長野市長野)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/31
func TestNJA031(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "大字長野" is oaza_cho, "東之門町" is koaza in Nagano city
			name: "nja031-1 [長野県長野市長野東之門町2462]",
			query: model.MatchQuery{
				Address:  "長野県長野市長野東之門町2462",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "長野県長野市大字長野東之門町",
			wantUnmatchedAddress: []string{"2462"},
			wantStructured: map[string]any{
				"pref":          "長野県",
				"county":        nil,
				"city":          "長野市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "大字長野",
				"chome":         nil,
				"koaza":         "東之門町",
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA032 tests addresses with nested town names (金木町喜良市千苅)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/32
func TestNJA032(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "金木町喜良市" is oaza_cho, "千苅" is koaza in Goshogawara city
			name: "nja032-1 [青森県五所川原市金木町喜良市千苅62-8]",
			query: model.MatchQuery{
				Address:  "青森県五所川原市金木町喜良市千苅62-8",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "青森県",
				"county":        nil,
				"city":          "五所川原市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "金木町喜良市",
				"chome":         nil,
				"koaza":         "千苅",
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      "62",
				"prc_num2":      "8",
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA034 tests kanji numeral town names that look like chome (e.g. 十二丁目)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/34
func TestNJA034(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "十二丁目" is oaza_cho in Hanamaki city (not a chome)
			name: "nja034-1 [岩手県花巻市十二丁目1192]",
			query: model.MatchQuery{
				Address:  "岩手県花巻市十二丁目1192",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "岩手県花巻市十二丁目",
			wantUnmatchedAddress: []string{"1192"},
			wantStructured: map[string]any{
				"pref":          "岩手県",
				"county":        nil,
				"city":          "花巻市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "十二丁目",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			// Note: "東十二丁目" is oaza_cho in Hanamaki city (not a chome)
			name: "nja034-1a [岩手県花巻市東十二丁目]",
			query: model.MatchQuery{
				Address:  "岩手県花巻市東十二丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "岩手県",
				"county":        nil,
				"city":          "花巻市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "東十二丁目",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA035 tests town names containing "万丁目" pattern
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/35
func TestNJA035(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "中北万丁目" is oaza_cho in Hanamaki city
			name: "nja035-1 [岩手県花巻市中北万丁目821-1]",
			query: model.MatchQuery{
				Address:  "岩手県花巻市中北万丁目821-1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "岩手県",
				"county":        nil,
				"city":          "花巻市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "中北万丁目",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      "1",
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			// Note: "上北万丁目" is oaza_cho in Hanamaki city
			name: "nja035-1a [岩手県花巻市上北万丁目]",
			query: model.MatchQuery{
				Address:  "岩手県花巻市上北万丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "岩手県",
				"county":        nil,
				"city":          "花巻市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "上北万丁目",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			// Note: "下北万丁目" is oaza_cho in Hanamaki city
			name: "nja035-1b [岩手県花巻市下北万丁目174-1]",
			query: model.MatchQuery{
				Address:  "岩手県花巻市下北万丁目174-1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "岩手県",
				"county":        nil,
				"city":          "花巻市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "下北万丁目",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      "1",
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			// Note: "南万丁目" is oaza_cho in Hanamaki city
			name: "nja035-1c [岩手県花巻市南万丁目]",
			query: model.MatchQuery{
				Address:  "岩手県花巻市南万丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "岩手県",
				"county":        nil,
				"city":          "花巻市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "南万丁目",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA036 tests single-kanji town name (後)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/36
func TestNJA036(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "後" is oaza_cho in Takizawa city (single kanji town name)
			name: "nja036-1 [岩手県滝沢市後268-566]",
			query: model.MatchQuery{
				Address:  "岩手県滝沢市後268-566",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "岩手県",
				"county":        nil,
				"city":          "滝沢市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "後",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      "268",
				"prc_num2":      "566",
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA037 tests 地割住所 (Iwate prefecture special addressing)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/37
func TestNJA037(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja037-1 [岩手県下閉伊郡普代村第１地割上村４３−２５]",
			query: model.MatchQuery{
				Address:  "岩手県下閉伊郡普代村第１地割上村４３−２５",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "岩手県下閉伊郡普代村第1地割字上村43-25",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "岩手県",
				"county":        "下閉伊郡",
				"city":          "普代村",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "第1地割字上村",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      "43",
				"prc_num2":      "25",
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA040 tests station-named addresses (盛岡駅西通)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/40
func TestNJA040(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "盛岡駅西通" is oaza_cho with chome in Morioka city
			name: "nja040-1 [岩手県盛岡市盛岡駅西通2丁目9番地1号]",
			query: model.MatchQuery{
				Address:  "岩手県盛岡市盛岡駅西通2丁目9番地1号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "岩手県",
				"county":        nil,
				"city":          "盛岡市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "盛岡駅西通",
				"chome":         "二丁目",
				"koaza":         nil,
				"blk_num":       "9",
				"rsdt_num":      "1",
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA042 tests addresses with chome that may look like block number (玉手2丁目465)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/42
func TestNJA042(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "玉手" has chome 1-4 in Himeji city
			name: "nja042-1 [兵庫県姫路市玉手2丁目465]",
			query: model.MatchQuery{
				Address:  "兵庫県姫路市玉手2丁目465",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "兵庫県",
				"county":        nil,
				"city":          "姫路市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "玉手",
				"chome":         "2丁目",
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      "465",
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA043 tests Sapporo jou-chome style addresses (北８条西5丁目)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/43
func TestNJA043(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: Sapporo uses "北8条西" as oaza_cho with chome "5丁目"
			name: "nja043-1 [北海道札幌市北区北８条西5丁目7]",
			query: model.MatchQuery{
				Address:  "北海道札幌市北区北８条西5丁目7",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "北海道",
				"county":        nil,
				"city":          "札幌市",
				"ward":          "北区",
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "北8条西",
				"chome":         "5丁目",
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      "7",
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA048 tests building name kanji numeral conversion
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/48
func TestNJA048(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja048-1 [大阪府堺市堺区向陵西町2丁1-26 Northグランドメゾン三国ヶ丘]",
			query: model.MatchQuery{
				Address:  "大阪府堺市堺区向陵西町2丁1-26 Northグランドメゾン三国ヶ丘",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "大阪府堺市堺区向陵西町2丁",
			wantUnmatchedAddress: []string{"1-26", "Northグランドメゾン三国ヶ丘"},
			wantStructured: map[string]any{
				"pref":          "大阪府",
				"county":        nil,
				"city":          "堺市",
				"ward":          "堺区",
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "向陵西町",
				"chome":         "2丁",
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA051 tests ヶ/ケ variant in town names (関ヶ原 vs 関ケ原)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/51
func TestNJA051(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: City is "関ケ原町" (with ケ), input uses "関ヶ原" (with ヶ)
			// DB has oaza_cho="大字関ケ原"
			name: "nja051-1 [岐阜県不破郡関ヶ原町関ヶ原1701-6]",
			query: model.MatchQuery{
				Address:  "岐阜県不破郡関ヶ原町関ヶ原1701-6",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "岐阜県",
				"county":        "不破郡",
				"city":          "関ケ原町",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "大字関ケ原",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      "1701",
				"prc_num2":      "6",
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA052 tests building name separation
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/52
func TestNJA052(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja052-1 [東京都千代田区永田町1丁目7-1 マンションジオロニア]",
			query: model.MatchQuery{
				Address:  "東京都千代田区永田町1丁目7-1 マンションジオロニア",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialBlock,
			wantMatchedAddress:   "東京都千代田区永田町一丁目7",
			wantUnmatchedAddress: []string{"-1", "マンションジオロニア"},
			wantStructured: map[string]any{
				"pref":          "東京都",
				"county":        nil,
				"city":          "千代田区",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "永田町",
				"chome":         "一丁目",
				"koaza":         nil,
				"blk_num":       "7",
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA055 tests katakana long vowel mark converted to hyphen in building name
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/55
func TestNJA055(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja055-1 [大阪府高槻市奈佐原２丁目１－２,メゾンエトワール]",
			query: model.MatchQuery{
				Address:  "大阪府高槻市奈佐原２丁目１－２,メゾンエトワール",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialBlock,
			wantMatchedAddress:   "大阪府高槻市奈佐原2丁目1",
			wantUnmatchedAddress: []string{"-2", ",メゾンエトワール"},
			wantStructured: map[string]any{
				"pref":          "大阪府",
				"county":        nil,
				"city":          "高槻市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "奈佐原",
				"chome":         "2丁目",
				"koaza":         nil,
				"blk_num":       "1",
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA056 tests standard Tokyo ward address (西五反田)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/56
func TestNJA056(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "西五反田" has chome 1-8 in Shinagawa ward
			name: "nja056-1 [東京都品川区西五反田2丁目31-6]",
			query: model.MatchQuery{
				Address:  "東京都品川区西五反田2丁目31-6",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "東京都",
				"county":        nil,
				"city":          "品川区",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "西五反田",
				"chome":         "2丁目",
				"koaza":         nil,
				"blk_num":       "31",
				"rsdt_num":      "6",
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA057 tests standard Tokyo ward address with kanji chome (上北沢)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/57
func TestNJA057(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "上北沢" has chome 1-5 in Setagaya ward
			name: "nja057-1 [東京都世田谷区上北沢4-2-1]",
			query: model.MatchQuery{
				Address:  "東京都世田谷区上北沢4-2-1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "東京都",
				"county":        nil,
				"city":          "世田谷区",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "上北沢",
				"chome":         "4丁目",
				"koaza":         nil,
				"blk_num":       "2",
				"rsdt_num":      "1",
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA067 tests address where 壱丁目 is oaza (not chome)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/67
func TestNJA067(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja067-1 [埼玉県上尾市壱丁目南15-15]",
			query: model.MatchQuery{
				Address:  "埼玉県上尾市壱丁目南15-15",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "埼玉県上尾市壱丁目南15-15",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "埼玉県",
				"county":        nil,
				"city":          "上尾市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "壱丁目南",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      "15",
				"prc_num2":      "15",
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA087 tests Hokkaido chome misrecognition
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/87
func TestNJA087(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja087-1 [北海道札幌市中央区北三条西３丁目１－５６マルゲンビル３Ｆ]",
			query: model.MatchQuery{
				Address:  "北海道札幌市中央区北三条西３丁目１－５６マルゲンビル３Ｆ",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "北海道札幌市中央区北3条西3丁目1-56",
			wantUnmatchedAddress: []string{"マルゲンビル3F"},
			wantStructured: map[string]any{
				"pref":          "北海道",
				"county":        nil,
				"city":          "札幌市",
				"ward":          "中央区",
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "北3条西",
				"chome":         "3丁目",
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      "1",
				"prc_num2":      "56",
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA089 tests Hokkaido zenkaku 条 issue
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/89
func TestNJA089(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja089-1 [北海道札幌市北区北２４条西６丁目１−１]",
			query: model.MatchQuery{
				Address:  "北海道札幌市北区北２４条西６丁目１−１",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "北海道札幌市北区北24条西6丁目1-1",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "北海道",
				"county":        nil,
				"city":          "札幌市",
				"ward":          "北区",
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "北24条西",
				"chome":         "6丁目",
				"koaza":         nil,
				"blk_num":       "1",
				"rsdt_num":      "1",
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA094 tests kanji and Arabic numerals adjacent causing crash
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/94
func TestNJA094(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: DBには 仲多度郡マンノウ町勝浦 (oaza_cho=勝浦) のみ存在し、「家六」という小字データはDBにない
			// 前方一致検索により machiaza レベルでマッチ
			name: "nja094-1 [香川県仲多度郡まんのう町勝浦字家六２０９４番地１]",
			query: model.MatchQuery{
				Address:  "香川県仲多度郡まんのう町勝浦字家六２０９４番地１",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "香川県仲多度郡まんのう町勝浦",
			wantUnmatchedAddress: []string{"家六2094-1"},
			wantStructured: map[string]any{
				"pref":          "香川県",
				"county":        "仲多度郡",
				"city":          "まんのう町",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "勝浦",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			// Issue #68: koaza "梶村一" should not be split by AddColon
			name: "nja094-2 [愛知県あま市西今宿梶村一３８番地４]",
			query: model.MatchQuery{
				Address:  "愛知県あま市西今宿梶村一３８番地４",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "愛知県あま市西今宿梶村一38-4",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "愛知県",
				"county":        nil,
				"city":          "あま市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "西今宿",
				"chome":         nil,
				"koaza":         "梶村一",
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      "38",
				"prc_num2":      "4",
				"prc_num3":      nil,
			},
		},
		{
			// Note: Complex koaza pattern - 前方一致検索により machiaza レベルでマッチ
			name: "nja094-3 [香川県丸亀市原田町字東三分一１９２６番地１]",
			query: model.MatchQuery{
				Address:  "香川県丸亀市原田町字東三分一１９２６番地１",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "香川県丸亀市原田町",
			wantUnmatchedAddress: []string{"東三分一1926-1"},
			wantStructured: map[string]any{
				"pref":          "香川県",
				"county":        nil,
				"city":          "丸亀市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "原田町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA095 tests building name containing N丁目 causing crash
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/95
func TestNJA095(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja095-1 [沖縄県那覇市小禄１丁目５番２３号１丁目マンション３０１]",
			query: model.MatchQuery{
				Address:  "沖縄県那覇市小禄１丁目５番２３号１丁目マンション３０１",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "沖縄県那覇市小禄1丁目5-23",
			wantUnmatchedAddress: []string{"1丁目マンション301"},
			wantStructured: map[string]any{
				"pref":          "沖縄県",
				"county":        nil,
				"city":          "那覇市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "小禄",
				"chome":         "1丁目",
				"koaza":         nil,
				"blk_num":       "5",
				"rsdt_num":      "23",
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA115 tests kanji variant addresses (一之舟入町, 菟道森本)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/115
func TestNJA115(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "菟道" is oaza_cho, "森本" is koaza in Uji city
			name: "nja115-1 [京都府宇治市菟道森本]",
			query: model.MatchQuery{
				Address:  "京都府宇治市菟道森本",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "京都府",
				"county":        nil,
				"city":          "宇治市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "菟道",
				"chome":         nil,
				"koaza":         "森本",
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA130 tests address with long vowel mark in town name (センター)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/130
func TestNJA130(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja130-1 [広島県広島市西区商工センター六丁目９番39号]",
			query: model.MatchQuery{
				Address:  "広島県広島市西区商工センター六丁目９番39号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "広島県広島市西区商工センター六丁目9-39",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "広島県",
				"county":        nil,
				"city":          "広島市",
				"ward":          "西区",
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "商工センター",
				"chome":         "六丁目",
				"koaza":         nil,
				"blk_num":       "9",
				"rsdt_num":      "39",
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA133 tests town with kanji numeral + 号 using Arabic numeral
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/133
func TestNJA133(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// rune-based Levenshtein (#374) により14号→14号北（距離1）が24号（距離1）より優先
			// 14号北は入力「14号」により近いため精度向上
			name: "nja133-1 [北海道上川郡東神楽町14号]",
			query: model.MatchQuery{
				Address:  "北海道上川郡東神楽町14号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "北海道",
				"county":        "上川郡",
				"city":          "東神楽町",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "14号北",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			// 漢数字「十四号」もアラビア数字変換後、14号北にマッチ
			name: "nja133-2 [北海道上川郡東神楽町十四号]",
			query: model.MatchQuery{
				Address:  "北海道上川郡東神楽町十四号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "北海道",
				"county":        "上川郡",
				"city":          "東神楽町",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "14号北",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			// 「14号北」を完全指定すれば正確にマッチすることの確認
			name: "nja133-3 [北海道上川郡東神楽町14号北] exact match",
			query: model.MatchQuery{
				Address:  "北海道上川郡東神楽町14号北",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "北海道上川郡東神楽町14号北",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "北海道",
				"county":        "上川郡",
				"city":          "東神楽町",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "14号北",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA144 tests address ending with kanji numeral causing crash
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/144
func TestNJA144(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: 前方一致検索により machiaza レベルでマッチ
			name: "nja144-1 [広島県府中市栗柄町名字八五十2459]",
			query: model.MatchQuery{
				Address:  "広島県府中市栗柄町名字八五十2459",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "広島県府中市栗柄町",
			wantUnmatchedAddress: []string{"名字八五十2459"},
			wantStructured: map[string]any{
				"pref":          "広島県",
				"county":        nil,
				"city":          "府中市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "栗柄町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA150 tests superscript hyphen normalization
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/150
func TestNJA150(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja150-1 [東京都千代田区永田町1⁻2⁻3]",
			query: model.MatchQuery{
				Address:  "東京都千代田区永田町1⁻2⁻3",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialBlock,
			wantMatchedAddress:   "東京都千代田区永田町一丁目2",
			wantUnmatchedAddress: []string{"-3"},
			wantStructured: map[string]any{
				"pref":          "東京都",
				"county":        nil,
				"city":          "千代田区",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "永田町",
				"chome":         "一丁目",
				"koaza":         nil,
				"blk_num":       "2",
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA153 tests city-only addresses (熊本県熊本市)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/153
func TestNJA153(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: This tests city-level matching for 熊本市 (which has wards)
			name: "nja153-1 [熊本県熊本市]",
			query: model.MatchQuery{
				Address:  "熊本県熊本市",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "熊本県",
				"county":        nil,
				"city":          "熊本市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      nil,
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA157 tests Kyoto street name removal conflicting with building name
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/157
func TestNJA157(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja157-1 [京都府京都市中京区山本町９９９番地おはようビル２０５号室]",
			query: model.MatchQuery{
				Address:  "京都府京都市中京区山本町９９９番地おはようビル２０５号室",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "京都府京都市中京区山本町",
			wantUnmatchedAddress: []string{"999", "おはようビル205号室"},
			wantStructured: map[string]any{
				"pref":          "京都府",
				"county":        nil,
				"city":          "京都市",
				"ward":          "中京区",
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "山本町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA158 tests oaza omission conflicting with town omission
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/158
func TestNJA158(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja158-1 [埼玉県川口市大字新堀]",
			query: model.MatchQuery{
				Address:  "埼玉県川口市大字新堀",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "埼玉県",
				"county":        nil,
				"city":          "川口市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "大字新堀",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			name: "nja158-2 [埼玉県さいたま市見沼区大字丸ヶ崎]",
			query: model.MatchQuery{
				Address:  "埼玉県さいたま市見沼区大字丸ヶ崎",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "埼玉県",
				"county":        nil,
				"city":          "さいたま市",
				"ward":          "見沼区",
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "大字丸ヶ崎",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA162 tests Kyoto street name removal conflicting with town omission
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/162
func TestNJA162(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja162-1 [京都府京都市下京区西中筋通北小路通上る丸屋町]",
			query: model.MatchQuery{
				Address:  "京都府京都市下京区西中筋通北小路通上る丸屋町",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "京都府京都市下京区西中筋通北小路上る丸屋町",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "京都府",
				"county":        nil,
				"city":          "京都市",
				"ward":          "下京区",
				"machiaza_dist": nil,
				"kyoto_st":      "西中筋通北小路上る",
				"oaza_cho":      "丸屋町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA165 tests katakana "リ" in town names (光リ堂町)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/165
func TestNJA165(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "光リ堂町" uses katakana "リ" not hiragana "り"
			name: "nja165-1 [京都府京都市中京区光リ堂町]",
			query: model.MatchQuery{
				Address:  "京都府京都市中京区光リ堂町",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "京都府",
				"county":        nil,
				"city":          "京都市",
				"ward":          "中京区",
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "光リ堂町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA167 tests Kyoto address normalization failure
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/167
func TestNJA167(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja167-1 [京都府京都市上京区主計町1番1号]",
			query: model.MatchQuery{
				Address:  "京都府京都市上京区主計町1番1号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "京都府京都市上京区主計町",
			wantUnmatchedAddress: []string{"1-1"},
			wantStructured: map[string]any{
				"pref":          "京都府",
				"county":        nil,
				"city":          "京都市",
				"ward":          "上京区",
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "主計町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA168 tests town abbreviation conflicting with typo
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/168
func TestNJA168(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja168-1 [北海道函館市桔梗町1-2-3]",
			query: model.MatchQuery{
				Address:  "北海道函館市桔梗町1-2-3",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "北海道函館市桔梗町",
			wantUnmatchedAddress: []string{"1-2-3"},
			wantStructured: map[string]any{
				"pref":          "北海道",
				"county":        nil,
				"city":          "函館市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "桔梗町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA170 tests addresses ending with "通" (志賀南通)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/170
func TestNJA170(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "志賀南通" has kanji chome (一丁目, 二丁目) in Nagoya Kita-ku
			name: "nja170-1 [愛知県名古屋市北区志賀南通2]",
			query: model.MatchQuery{
				Address:  "愛知県名古屋市北区志賀南通2",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "愛知県",
				"county":        nil,
				"city":          "名古屋市",
				"ward":          "北区",
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "志賀南通",
				"chome":         "二丁目",
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA172 tests building name with 万/萬/億/兆 and hyphen causing crash
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/172
func TestNJA172(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja172-1 [東京都千代田区永田町1-2-3-ホゲホゲマンション万101]",
			query: model.MatchQuery{
				Address:  "東京都千代田区永田町1-2-3-ホゲホゲマンション万101",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialBlock,
			wantMatchedAddress:   "東京都千代田区永田町一丁目2",
			wantUnmatchedAddress: []string{"-3", "-ホゲホゲマンション万101"},
			wantStructured: map[string]any{
				"pref":          "東京都",
				"county":        nil,
				"city":          "千代田区",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "永田町",
				"chome":         "一丁目",
				"koaza":         nil,
				"blk_num":       "2",
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA173 tests invalid kanji numeral causing crash
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/173
func TestNJA173(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: This tests that no crash occurs with invalid kanji numeral
			// 百二三 (百+二+三) is invalid position-structure, processed as individual digits: 100+2+3 = "10023"
			name: "nja173-1 [東京都千代田区永田町百二三]",
			query: model.MatchQuery{
				Address:  "東京都千代田区永田町百二三",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都千代田区永田町一丁目",
			wantUnmatchedAddress: []string{"10023"},
			wantStructured: map[string]any{
				"pref":          "東京都",
				"county":        nil,
				"city":          "千代田区",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "永田町",
				"chome":         "一丁目",
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA176 tests old kanji variant 弥/彌
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/176
func TestNJA176(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: Currently the old kanji 彌 is not normalized to 弥
			name: "nja176-1 [愛知県名古屋市瑞穂区彌富通]",
			query: model.MatchQuery{
				Address:  "愛知県名古屋市瑞穂区彌富通",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "愛知県",
				"county":        nil,
				"city":          "名古屋市",
				"ward":          "瑞穂区",
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "彌富通",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA178 tests Osaka city recognized as Osaka prefecture
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/178
func TestNJA178(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja178-1 [大阪市中央区谷町4丁目3番地]",
			query: model.MatchQuery{
				Address:  "大阪市中央区谷町4丁目3番地",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "大阪府大阪市中央区谷町4丁目3",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "大阪府",
				"county":        nil,
				"city":          "大阪市",
				"ward":          "中央区",
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "谷町",
				"chome":         "4丁目",
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      "3",
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA180 tests space in city/ward part causing normalization failure
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/180
func TestNJA180(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: Ward and oaza_cho may not be extracted due to space
			name: "nja180-1 [京都府京都市　下京区上之町999]",
			query: model.MatchQuery{
				Address:  "京都府京都市　下京区上之町999",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "京都府京都市",
			wantUnmatchedAddress: []string{"下京区上之町999"},
			wantStructured: map[string]any{
				"pref":          "京都府",
				"county":        nil,
				"city":          "京都市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      nil,
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			// Note: Ward and oaza_cho may not be extracted due to space
			name: "nja180-2 [宮城県仙台市 若林区土樋999]",
			query: model.MatchQuery{
				Address:  "宮城県仙台市 若林区土樋999",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "宮城県仙台市",
			wantUnmatchedAddress: []string{"若林区土樋999"},
			wantStructured: map[string]any{
				"pref":          "宮城県",
				"county":        nil,
				"city":          "仙台市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      nil,
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA184 tests addresses with kanji numerals followed by "の" (ichinosakacho, ichinomiya)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/184
func TestNJA184(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: "一の坂町西" exists in DB as oaza_cho (with and without chome)
			name: "nja184-1 [北海道滝川市一の坂町西]",
			query: model.MatchQuery{
				Address:  "北海道滝川市一の坂町西",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "北海道",
				"county":        nil,
				"city":          "滝川市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "一の坂町西",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			// Note: "二の坂町" exists in DB as oaza_cho (no chome)
			name: "nja184-1a [北海道滝川市二の坂町]",
			query: model.MatchQuery{
				Address:  "北海道滝川市二の坂町",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "北海道",
				"county":        nil,
				"city":          "滝川市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "二の坂町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			// Note: "一の宮住吉" is oaza_cho in DB, requires chome for full match
			name: "nja184-2 [山口県下関市一の宮住吉一丁目]",
			query: model.MatchQuery{
				Address:  "山口県下関市一の宮住吉一丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "山口県",
				"county":        nil,
				"city":          "下関市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "一の宮住吉",
				"chome":         "一丁目",
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			// Note: "一の宮学園町" has no chome in DB
			name: "nja184-2a [山口県下関市一の宮学園町]",
			query: model.MatchQuery{
				Address:  "山口県下関市一の宮学園町",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "山口県",
				"county":        nil,
				"city":          "下関市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "一の宮学園町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA185 tests long vowel mark converted to hyphen in building name
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/185
func TestNJA185(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja185-1 [東京都千代田区丸の内１丁目９番１号グラントウキョウノースタワー３６階]",
			query: model.MatchQuery{
				Address:  "東京都千代田区丸の内１丁目９番１号グラントウキョウノースタワー３６階",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialBlock,
			wantMatchedAddress:   "東京都千代田区丸の内一丁目9",
			wantUnmatchedAddress: []string{"-1", "グラントウキョウノースタワー36階"},
			wantStructured: map[string]any{
				"pref":          "東京都",
				"county":        nil,
				"city":          "千代田区",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "丸の内",
				"chome":         "一丁目",
				"koaza":         nil,
				"blk_num":       "9",
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA186 tests building name starting with number misidentified as address
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/186
func TestNJA186(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja186-1 [東京都千代田区神田淡路町１丁目５番地二引ビル５階]",
			query: model.MatchQuery{
				Address:  "東京都千代田区神田淡路町１丁目５番地二引ビル５階",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都千代田区神田淡路町一丁目",
			wantUnmatchedAddress: []string{"5", "二引ビル5階"},
			wantStructured: map[string]any{
				"pref":          "東京都",
				"county":        nil,
				"city":          "千代田区",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "神田淡路町",
				"chome":         "一丁目",
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA188 tests kana variation ヶ/ケ/ガ/が
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/188
func TestNJA188(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja188-1 [千葉県鎌ヶ谷市]",
			query: model.MatchQuery{
				Address:  "千葉県鎌ヶ谷市",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "千葉県鎌ケ谷市",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "千葉県",
				"county":        nil,
				"city":          "鎌ケ谷市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      nil,
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA190 tests kanji variant 麩/麸 and 碕/さき
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/190
func TestNJA190(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja190-1 [愛知県津島市池麩町]",
			query: model.MatchQuery{
				Address:  "愛知県津島市池麩町",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "愛知県",
				"county":        nil,
				"city":          "津島市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "池麸町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			name: "nja190-2 [愛知県安城市柿碕町]",
			query: model.MatchQuery{
				Address:  "愛知県安城市柿碕町",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "愛知県",
				"county":        nil,
				"city":          "安城市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "柿𥔎町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA193 tests similar town name misrecognition
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/193
func TestNJA193(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja193-1 [東京都町田市金井ヶ丘２丁目２４−２９]",
			query: model.MatchQuery{
				Address:  "東京都町田市金井ヶ丘２丁目２４−２９",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都町田市金井ヶ丘2丁目",
			wantUnmatchedAddress: []string{"24-29"},
			wantStructured: map[string]any{
				"pref":          "東京都",
				"county":        nil,
				"city":          "町田市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "金井ヶ丘",
				"chome":         "2丁目",
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA194 tests special municipality (islands)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/194
func TestNJA194(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: 八丈島 island addressing may not be fully supported
			name: "nja194-1 [東京都八丈島八丈町三根99999]",
			query: model.MatchQuery{
				Address:  "東京都八丈島八丈町三根99999",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelPrefecture,
			wantMatchedAddress:   "東京都",
			wantUnmatchedAddress: []string{"八丈島八丈町三根99999"},
			wantStructured: map[string]any{
				"pref":          "東京都",
				"county":        nil,
				"city":          nil,
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      nil,
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA197 tests identical town names with different readings
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/197
func TestNJA197(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: Identical kanji town names with different readings (トウエイチョウ/ヒガシサカエマチ)
			// chome表記なし＋ハイフン形式 "2-12" は、chome無し・地番専用の
			// 「ヒガシサカエマチ」レコード(machiaza_id=0095000)にマッチし地番解釈される
			name: "nja197-1 [新潟県新潟市北区東栄町2-12]",
			query: model.MatchQuery{
				Address:  "新潟県新潟市北区東栄町2-12",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "新潟県新潟市北区東栄町2-12",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "新潟県",
				"county":        nil,
				"city":          "新潟市",
				"ward":          "北区",
				"machiaza_dist": "ヒガシサカエマチ",
				"kyoto_st":      nil,
				"oaza_cho":      "東栄町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      "2",
				"prc_num2":      "12",
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA215 tests koaza with invalid kanji numeral (三五十)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/215
func TestNJA215(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja215-1 [愛知県豊田市西丹波町三五十]",
			query: model.MatchQuery{
				Address:  "愛知県豊田市西丹波町三五十",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "愛知県",
				"county":        nil,
				"city":          "豊田市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "西丹波町",
				"chome":         nil,
				"koaza":         "三五十",
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA233 tests kanji variant 崎/﨑
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/233
func TestNJA233(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: 﨑 (U+FA11) should be normalized to 崎 (U+5D0E)
			name: "nja233-1 [奈良県宇陀市菟田野岩﨑]",
			query: model.MatchQuery{
				Address:  "奈良県宇陀市菟田野岩﨑",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "奈良県宇陀市菟田野岩崎",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "奈良県",
				"county":        nil,
				"city":          "宇陀市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "菟田野岩崎",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			// Note: 﨑 (U+FA11) should be normalized to 崎 (U+5D0E)
			name: "nja233-2 [茨城県ひたちなか市磯﨑町]",
			query: model.MatchQuery{
				Address:  "茨城県ひたちなか市磯﨑町",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "茨城県ひたちなか市磯崎町",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "茨城県",
				"county":        nil,
				"city":          "ひたちなか市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "磯崎町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA237 tests residential display vs land lot number confusion
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/237
func TestNJA237(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja237-1 [千葉県浦安市舞浜2丁目11]",
			query: model.MatchQuery{
				Address:  "千葉県浦安市舞浜2丁目11",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialBlock,
			wantMatchedAddress:   "千葉県浦安市舞浜2丁目11",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "千葉県",
				"county":        nil,
				"city":          "浦安市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "舞浜",
				"chome":         "2丁目",
				"koaza":         nil,
				"blk_num":       "11",
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			name: "nja237-2 [千葉県浦安市舞浜2-11]",
			query: model.MatchQuery{
				Address:  "千葉県浦安市舞浜2-11",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialBlock,
			wantMatchedAddress:   "千葉県浦安市舞浜2丁目11",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "千葉県",
				"county":        nil,
				"city":          "浦安市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "舞浜",
				"chome":         "2丁目",
				"koaza":         nil,
				"blk_num":       "11",
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA252 tests kanji variant 騨/驒 (Hida city)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/252
func TestNJA252(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: 驒 (U+9A52) should be normalized to 騨 (U+9A28)
			name: "nja252-1 [岐阜県飛驒市]",
			query: model.MatchQuery{
				Address:  "岐阜県飛驒市",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "岐阜県飛騨市",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "岐阜県",
				"county":        nil,
				"city":          "飛騨市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      nil,
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA259 tests town name mismatch (longer pattern priority issue)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/259
func TestNJA259(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja259-1 [栃木県宇都宮市一番町3-17]",
			query: model.MatchQuery{
				Address:  "栃木県宇都宮市一番町3-17",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "栃木県宇都宮市一番町3-17",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "栃木県",
				"county":        nil,
				"city":          "宇都宮市",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "一番町",
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       "3",
				"rsdt_num":      "17",
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA260 tests empty town name matching incorrectly
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/260
func TestNJA260(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "nja260-1 [宮城県柴田郡大河原町]",
			query: model.MatchQuery{
				Address:  "宮城県柴田郡大河原町",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "宮城県",
				"county":        "柴田郡",
				"city":          "大河原町",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      nil,
				"chome":         nil,
				"koaza":         nil,
				"blk_num":       nil,
				"rsdt_num":      nil,
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}

// TestNJA266 tests kanji vs arabic numerals in chome (本駒込二丁目 vs 本駒込２丁目)
// Issue: https://github.com/geolonia/normalize-japanese-addresses/issues/266
func TestNJA266(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// Note: Kanji numeral "二" in chome should normalize consistently with arabic "２"
			name: "nja266-1 [東京都文京区本駒込二丁目28番8号]",
			query: model.MatchQuery{
				Address:  "東京都文京区本駒込二丁目28番8号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "東京都",
				"county":        nil,
				"city":          "文京区",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "本駒込",
				"chome":         "2丁目",
				"koaza":         nil,
				"blk_num":       "28",
				"rsdt_num":      "8",
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
		{
			// Note: Arabic numeral "２" in chome should normalize consistently with kanji "二"
			name: "nja266-2 [東京都文京区本駒込２丁目28番8号]",
			query: model.MatchQuery{
				Address:  "東京都文京区本駒込２丁目28番8号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				"pref":          "東京都",
				"county":        nil,
				"city":          "文京区",
				"ward":          nil,
				"machiaza_dist": nil,
				"kyoto_st":      nil,
				"oaza_cho":      "本駒込",
				"chome":         "2丁目",
				"koaza":         nil,
				"blk_num":       "28",
				"rsdt_num":      "8",
				"rsdt_num2":     nil,
				"prc_num1":      nil,
				"prc_num2":      nil,
				"prc_num3":      nil,
			},
		},
	})
}
