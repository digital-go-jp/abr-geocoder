package model

import "testing"

func TestMergeFrom(t *testing.T) {
	strPtr := func(s string) *string { return &s }

	tests := []struct {
		name     string
		dst      StructuredAddress
		src      StructuredAddress
		expected StructuredAddress
	}{
		{
			name: "merge into empty dst",
			dst:  StructuredAddress{},
			src: StructuredAddress{
				Pref: strPtr("東京都"),
				City: strPtr("千代田区"),
			},
			expected: StructuredAddress{
				Pref: strPtr("東京都"),
				City: strPtr("千代田区"),
			},
		},
		{
			name: "dst fields take precedence",
			dst: StructuredAddress{
				Pref: strPtr("大阪府"),
			},
			src: StructuredAddress{
				Pref: strPtr("東京都"),
				City: strPtr("千代田区"),
			},
			expected: StructuredAddress{
				Pref: strPtr("大阪府"),
				City: strPtr("千代田区"),
			},
		},
		{
			name: "merge all fields",
			dst:  StructuredAddress{},
			src: StructuredAddress{
				Pref:    strPtr("東京都"),
				County:  strPtr(""),
				City:    strPtr("千代田区"),
				Ward:    strPtr(""),
				KyotoSt: strPtr(""),
				OazaCho: strPtr("紀尾井町"),
				Chome:   strPtr("1"),
				Koaza:   strPtr(""),
				BlkNum:  strPtr("3"),
				RsdtNum: strPtr("5"),
			},
			expected: StructuredAddress{
				Pref:    strPtr("東京都"),
				County:  strPtr(""),
				City:    strPtr("千代田区"),
				Ward:    strPtr(""),
				KyotoSt: strPtr(""),
				OazaCho: strPtr("紀尾井町"),
				Chome:   strPtr("1"),
				Koaza:   strPtr(""),
				BlkNum:  strPtr("3"),
				RsdtNum: strPtr("5"),
			},
		},
		{
			name:     "both empty",
			dst:      StructuredAddress{},
			src:      StructuredAddress{},
			expected: StructuredAddress{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.dst.MergeFrom(&tt.src)

			// Check each field
			checkField := func(name string, got, want *string) {
				if got == nil && want == nil {
					return
				}
				if got == nil || want == nil {
					t.Errorf("%s: got %v, want %v", name, got, want)
					return
				}
				if *got != *want {
					t.Errorf("%s: got %q, want %q", name, *got, *want)
				}
			}

			checkField("Pref", tt.dst.Pref, tt.expected.Pref)
			checkField("County", tt.dst.County, tt.expected.County)
			checkField("City", tt.dst.City, tt.expected.City)
			checkField("Ward", tt.dst.Ward, tt.expected.Ward)
			checkField("KyotoSt", tt.dst.KyotoSt, tt.expected.KyotoSt)
			checkField("OazaCho", tt.dst.OazaCho, tt.expected.OazaCho)
			checkField("Chome", tt.dst.Chome, tt.expected.Chome)
			checkField("Koaza", tt.dst.Koaza, tt.expected.Koaza)
			checkField("BlkNum", tt.dst.BlkNum, tt.expected.BlkNum)
			checkField("RsdtNum", tt.dst.RsdtNum, tt.expected.RsdtNum)
		})
	}
}

func TestFormatAddress(t *testing.T) {
	strPtr := func(s string) *string { return &s }

	tests := []struct {
		name string
		sa   StructuredAddress
		want string
	}{
		{
			name: "full residential address",
			sa: StructuredAddress{
				Pref: strPtr("東京都"), City: strPtr("千代田区"),
				OazaCho: strPtr("紀尾井町"), BlkNum: strPtr("1"),
				RsdtNum: strPtr("3"),
			},
			want: "東京都千代田区紀尾井町1-3",
		},
		{
			name: "residential with rsdt_num2",
			sa: StructuredAddress{
				Pref: strPtr("東京都"), City: strPtr("千代田区"),
				OazaCho: strPtr("紀尾井町"), BlkNum: strPtr("1"),
				RsdtNum: strPtr("3"), RsdtNum2: strPtr("5"),
			},
			want: "東京都千代田区紀尾井町1-3-5",
		},
		{
			name: "parcel address",
			sa: StructuredAddress{
				Pref: strPtr("北海道"), City: strPtr("札幌市"),
				Ward: strPtr("中央区"), OazaCho: strPtr("北一条西"),
				PrcNum1: strPtr("1"), PrcNum2: strPtr("2"),
			},
			want: "北海道札幌市中央区北一条西1-2",
		},
		{
			name: "parcel with prc_num3",
			sa: StructuredAddress{
				Pref: strPtr("東京都"), City: strPtr("八王子市"),
				OazaCho: strPtr("元横山町"),
				PrcNum1: strPtr("10"), PrcNum2: strPtr("2"), PrcNum3: strPtr("3"),
			},
			want: "東京都八王子市元横山町10-2-3",
		},
		{
			name: "with county",
			sa: StructuredAddress{
				Pref: strPtr("千葉県"), County: strPtr("印旛郡"),
				City: strPtr("酒々井町"), OazaCho: strPtr("中央台"),
			},
			want: "千葉県印旛郡酒々井町中央台",
		},
		{
			name: "kyoto street",
			sa: StructuredAddress{
				Pref: strPtr("京都府"), City: strPtr("京都市"),
				Ward: strPtr("中京区"), KyotoSt: strPtr("寺町通御池上る"),
				OazaCho: strPtr("上本能寺前町"),
			},
			want: "京都府京都市中京区寺町通御池上る上本能寺前町",
		},
		{
			name: "with chome and koaza",
			sa: StructuredAddress{
				Pref: strPtr("東京都"), City: strPtr("世田谷区"),
				OazaCho: strPtr("成城"), Chome: strPtr("一丁目"),
				Koaza: strPtr("イ"),
			},
			want: "東京都世田谷区成城一丁目イ",
		},
		{
			name: "empty address",
			sa:   StructuredAddress{},
			want: "",
		},
		{
			name: "all nil fields",
			sa:   StructuredAddress{},
			want: "",
		},
		{
			name: "pref only",
			sa:   StructuredAddress{Pref: strPtr("東京都")},
			want: "東京都",
		},
		{
			name: "blk_num without rsdt_num",
			sa: StructuredAddress{
				Pref: strPtr("東京都"), City: strPtr("千代田区"),
				OazaCho: strPtr("紀尾井町"), BlkNum: strPtr("1"),
			},
			want: "東京都千代田区紀尾井町1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := FormatAddress(&tt.sa)
			if got != tt.want {
				t.Errorf("FormatAddress() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestMergePtr(t *testing.T) {
	strPtr := func(s string) *string { return &s }

	tests := []struct {
		name     string
		dst      *string
		src      *string
		expected *string
	}{
		{
			name:     "dst nil, src has value",
			dst:      nil,
			src:      strPtr("value"),
			expected: strPtr("value"),
		},
		{
			name:     "dst has value, src has value",
			dst:      strPtr("original"),
			src:      strPtr("new"),
			expected: strPtr("original"),
		},
		{
			name:     "both nil",
			dst:      nil,
			src:      nil,
			expected: nil,
		},
		{
			name:     "dst has value, src nil",
			dst:      strPtr("original"),
			src:      nil,
			expected: strPtr("original"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mergePtr(&tt.dst, &tt.src)
			if tt.dst == nil && tt.expected == nil {
				return
			}
			if tt.dst == nil || tt.expected == nil {
				t.Errorf("got %v, want %v", tt.dst, tt.expected)
				return
			}
			if *tt.dst != *tt.expected {
				t.Errorf("got %q, want %q", *tt.dst, *tt.expected)
			}
		})
	}
}

func TestCategoryKnown(t *testing.T) {
	tests := []struct {
		category Category
		want     bool
	}{
		{CategoryAll, true},
		{CategoryBasic, true},
		{CategoryResidential, true},
		{CategoryParcel, true},
		{"", true},
		{"bogus", false},
		{"ALL", false},
	}

	for _, tt := range tests {
		t.Run(string(tt.category), func(t *testing.T) {
			if got := tt.category.Known(); got != tt.want {
				t.Errorf("Category(%q).Known() = %v, want %v", tt.category, got, tt.want)
			}
		})
	}
}
