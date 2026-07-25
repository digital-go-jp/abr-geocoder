package util

import (
	"slices"
	"testing"
)

// The tests in this file pin the current behavior of the unmatched extraction
// heuristics so that refactoring cannot change it unnoticed. Expected values
// are the observed output of the current implementation.

func TestExtractUnmatchedParts_CaseTable(t *testing.T) {
	tests := []struct {
		name           string
		originalAddr   string
		normalizedAddr string
		matchedAddr    string
		searchAddr     string
		want           []string
	}{
		{
			name:           "at without colon extracts numbers after at",
			originalAddr:   "北海道小樽市入船3丁目4-1",
			normalizedAddr: "北海道小樽市入船3丁目4-1",
			matchedAddr:    "北海道小樽市入船3丁目",
			searchAddr:     "小樽市入船3@4-1",
			want:           []string{"4-1"},
		},
		{
			name:           "at without colon and nothing after at means full match",
			originalAddr:   "文京区大塚一丁目",
			normalizedAddr: "文京区大塚一丁目",
			matchedAddr:    "東京都文京区大塚1丁目",
			searchAddr:     "文京区大塚1@",
			want:           nil,
		},
		{
			name:           "no colon nor at extracts suffix of normalized beyond matched",
			originalAddr:   "愛知県清須市助七一",
			normalizedAddr: "愛知県清須市助七一",
			matchedAddr:    "愛知県清須市助七",
			searchAddr:     "清須市助七1",
			want:           []string{"一"},
		},
		{
			name:           "no colon nor at falls back to trailing numbers of searchAddr",
			originalAddr:   "神戸市中央区磯上通8丁目3-5",
			normalizedAddr: "神戸市中央区磯上通8丁目3-5",
			matchedAddr:    "兵庫県神戸市中央区磯上通8丁目",
			searchAddr:     "神戸市中央区磯上通8丁目3-5",
			want:           []string{"3-5"},
		},
		{
			name:           "koaza prefix before colon is prepended to unmatched numbers",
			originalAddr:   "佐賀県嬉野市嬉野町下野長波須ハ丙1234",
			normalizedAddr: "佐賀県嬉野市嬉野町下野長波須ハ丙1234",
			matchedAddr:    "佐賀県嬉野市嬉野町大字下野",
			searchAddr:     "嬉野市嬉野町下野長波須ハ丙:1234",
			want:           []string{"長波須ハ丙1234"},
		},
		{
			name:           "chome consumed as bare number after colon",
			originalAddr:   "東京都文京区大塚2",
			normalizedAddr: "東京都文京区大塚2",
			matchedAddr:    "東京都文京区大塚二丁目",
			searchAddr:     "文京区大塚:2",
			want:           nil,
		},
		{
			name:           "colon with trailing empty after part keeps matched address",
			originalAddr:   "東京都港区虎ノ門1",
			normalizedAddr: "東京都港区虎ノ門1",
			matchedAddr:    "東京都港区虎ノ門1丁目",
			searchAddr:     "港区虎ノ門:",
			want:           []string{"東京都港区虎ノ門1丁目"},
		},
		{
			name:           "building names only when everything matched",
			originalAddr:   "東京都渋谷区神宮前 タワーB 2階",
			normalizedAddr: "東京都渋谷区神宮前 タワーB 2階",
			matchedAddr:    "東京都渋谷区神宮前",
			searchAddr:     "",
			want:           []string{"タワーB", "2階"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ExtractUnmatchedParts(tt.originalAddr, tt.normalizedAddr, tt.matchedAddr, tt.searchAddr)
			if !slices.Equal(got, tt.want) {
				t.Errorf("ExtractUnmatchedParts(%q, %q, %q, %q) = %v, want %v",
					tt.originalAddr, tt.normalizedAddr, tt.matchedAddr, tt.searchAddr, got, tt.want)
			}
		})
	}
}

func TestExtractUnmatchedWithColon(t *testing.T) {
	tests := []struct {
		name             string
		originalAddr     string
		standardizedPart string
		matchedAddr      string
		beforeColon      string
		afterColon       string
		want             string
	}{
		{
			name:             "chome in matched strips leading chome number",
			originalAddr:     "東京都文京区大塚1-0",
			standardizedPart: "東京都文京区大塚1-0",
			matchedAddr:      "東京都文京区大塚1丁目",
			beforeColon:      "文京区大塚",
			afterColon:       "1-0",
			want:             "0",
		},
		{
			name:             "no chome keeps after part as-is",
			originalAddr:     "東京都中央区八丁堀12-7",
			standardizedPart: "東京都中央区八丁堀12-7",
			matchedAddr:      "東京都中央区八丁堀",
			beforeColon:      "中央区8丁堀",
			afterColon:       "12-7",
			want:             "12-7",
		},
		{
			name:             "koaza prefix from beforeColon prepended",
			originalAddr:     "佐賀県嬉野市嬉野町下野長波須ハ丙1234",
			standardizedPart: "佐賀県嬉野市嬉野町下野長波須ハ丙1234",
			matchedAddr:      "佐賀県嬉野市嬉野町大字下野",
			beforeColon:      "嬉野市嬉野町下野長波須ハ丙",
			afterColon:       "1234",
			want:             "長波須ハ丙1234",
		},
		{
			name:             "koaza recovered from standardized part with aza marker stripped",
			originalAddr:     "宮城県登米市迫町佐沼字家六15",
			standardizedPart: "宮城県登米市迫町佐沼字家六15",
			matchedAddr:      "宮城県登米市迫町佐沼",
			beforeColon:      "登米市迫町佐沼",
			afterColon:       "15",
			want:             "家六15",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractUnmatchedWithColon(tt.originalAddr, tt.standardizedPart, tt.matchedAddr, tt.beforeColon, tt.afterColon)
			if got != tt.want {
				t.Errorf("extractUnmatchedWithColon(%q, %q, %q, %q, %q) = %q, want %q",
					tt.originalAddr, tt.standardizedPart, tt.matchedAddr, tt.beforeColon, tt.afterColon, got, tt.want)
			}
		})
	}
}

func TestExtractUnmatchedWithColonAt(t *testing.T) {
	tests := []struct {
		name             string
		originalAddr     string
		standardizedPart string
		matchedAddr      string
		beforeColon      string
		afterColon       string
		want             string
	}{
		{
			name:             "chome matched returns after colon",
			originalAddr:     "東京都千代田区紀尾井町1-3",
			standardizedPart: "東京都千代田区紀尾井町1-3",
			matchedAddr:      "東京都千代田区紀尾井町1丁目",
			beforeColon:      "千代田区紀尾井町1@",
			afterColon:       "3",
			want:             "3",
		},
		{
			name:             "name after at not in matched is prepended",
			originalAddr:     "大阪府大阪市中央区久太郎町4丁目渡辺3",
			standardizedPart: "大阪府大阪市中央区久太郎町4丁目渡辺3",
			matchedAddr:      "大阪府大阪市中央区久太郎町4丁目",
			beforeColon:      "大阪市中央区久太郎町4@渡辺",
			afterColon:       "3",
			want:             "渡辺3",
		},
		{
			name:             "name after at already in matched is dropped",
			originalAddr:     "大分県佐伯市京町8丁目横町63",
			standardizedPart: "大分県佐伯市京町8丁目横町63",
			matchedAddr:      "大分県佐伯市京町8丁目横町",
			beforeColon:      "佐伯市京町8@横町",
			afterColon:       "63",
			want:             "63",
		},
		{
			name:             "chome not matched includes chome in unmatched",
			originalAddr:     "東京都千代田区紀尾井町一丁目3",
			standardizedPart: "東京都千代田区紀尾井町1丁目3",
			matchedAddr:      "東京都千代田区紀尾井町",
			beforeColon:      "千代田区紀尾井町1@",
			afterColon:       "3",
			want:             "1丁目3",
		},
		{
			name:             "chome pattern missing from standardized combines with hyphen",
			originalAddr:     "東京都千代田区紀尾井町1-3",
			standardizedPart: "東京都千代田区紀尾井町1-3",
			matchedAddr:      "東京都千代田区紀尾井町",
			beforeColon:      "千代田区紀尾井町1@",
			afterColon:       "3",
			want:             "1-3",
		},
		{
			name:             "no chome digits before at returns after colon",
			originalAddr:     "東京都港区虎ノ門5",
			standardizedPart: "東京都港区虎ノ門5",
			matchedAddr:      "東京都港区虎ノ門",
			beforeColon:      "港区虎ノ門@",
			afterColon:       "5",
			want:             "5",
		},
		{
			name:             "no chome digits and empty after colon returns matched address",
			originalAddr:     "東京都港区虎ノ門",
			standardizedPart: "東京都港区虎ノ門",
			matchedAddr:      "東京都港区虎ノ門",
			beforeColon:      "港区虎ノ門@",
			afterColon:       "",
			want:             "東京都港区虎ノ門",
		},
		{
			name:             "at at index zero returns after colon",
			originalAddr:     "原宿1",
			standardizedPart: "原宿1",
			matchedAddr:      "原宿",
			beforeColon:      "@原宿",
			afterColon:       "1",
			want:             "1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractUnmatchedWithColonAt(tt.originalAddr, tt.standardizedPart, tt.matchedAddr, tt.beforeColon, tt.afterColon)
			if got != tt.want {
				t.Errorf("extractUnmatchedWithColonAt(%q, %q, %q, %q, %q) = %q, want %q",
					tt.originalAddr, tt.standardizedPart, tt.matchedAddr, tt.beforeColon, tt.afterColon, got, tt.want)
			}
		})
	}
}

func TestExtractUnmatchedWithColonNoAt(t *testing.T) {
	tests := []struct {
		name             string
		originalAddr     string
		standardizedPart string
		matchedAddr      string
		afterColon       string
		want             string
	}{
		{
			name:             "leading number matching chome in matched is stripped",
			originalAddr:     "東京都文京区大塚1-0",
			standardizedPart: "東京都文京区大塚1-0",
			matchedAddr:      "東京都文京区大塚1丁目",
			afterColon:       "1-0",
			want:             "0",
		},
		{
			name:             "leading number matching chome in standardized is stripped",
			originalAddr:     "東京都豊島区長崎3丁目5-3-2414",
			standardizedPart: "東京都豊島区長崎3丁目5-3-2414",
			matchedAddr:      "東京都豊島区長崎",
			afterColon:       "3-5-3-2414",
			want:             "5-3-2414",
		},
		{
			name:             "no chome pattern keeps after colon as-is",
			originalAddr:     "東京都中央区八丁堀12-7",
			standardizedPart: "東京都中央区八丁堀12-7",
			matchedAddr:      "東京都中央区八丁堀",
			afterColon:       "12-7",
			want:             "12-7",
		},
		{
			name:             "digits with trailing hyphen consumed as chome",
			originalAddr:     "東京都港区虎ノ門1-",
			standardizedPart: "東京都港区虎ノ門1-",
			matchedAddr:      "東京都港区虎ノ門",
			afterColon:       "1-",
			want:             "",
		},
		{
			name:             "bare number consumed by kanji chome",
			originalAddr:     "東京都文京区大塚2",
			standardizedPart: "東京都文京区大塚2",
			matchedAddr:      "東京都文京区大塚二丁目",
			afterColon:       "2",
			want:             "",
		},
		{
			name:             "go number restored from original kanji form",
			originalAddr:     "北海道石狩市花川北一条一丁目一号",
			standardizedPart: "北海道石狩市花川北一条一丁目一号",
			matchedAddr:      "北海道石狩市花川北一条1丁目",
			afterColon:       "1号",
			want:             "一号",
		},
		{
			name:             "bare number without chome kept as-is",
			originalAddr:     "東京都中央区八丁堀45",
			standardizedPart: "東京都中央区八丁堀45",
			matchedAddr:      "東京都中央区八丁堀",
			afterColon:       "45",
			want:             "45",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractUnmatchedWithColonNoAt(tt.originalAddr, tt.standardizedPart, tt.matchedAddr, tt.afterColon)
			if got != tt.want {
				t.Errorf("extractUnmatchedWithColonNoAt(%q, %q, %q, %q) = %q, want %q",
					tt.originalAddr, tt.standardizedPart, tt.matchedAddr, tt.afterColon, got, tt.want)
			}
		})
	}
}

func TestExtractUnmatchedPrefixFromBeforeColon(t *testing.T) {
	tests := []struct {
		name        string
		beforeColon string
		matchedAddr string
		want        string
	}{
		{
			name:        "koaza after matched prefix",
			beforeColon: "嬉野市嬉野町下野長波須ハ丙",
			matchedAddr: "佐賀県嬉野市嬉野町大字下野",
			want:        "長波須ハ丙",
		},
		{
			name:        "exact match yields empty",
			beforeColon: "嬉野市嬉野町下野",
			matchedAddr: "佐賀県嬉野市嬉野町大字下野",
			want:        "",
		},
		{
			name:        "suffix search when matched is not a prefix",
			beforeColon: "嬉野町下野長波須ハ丙",
			matchedAddr: "佐賀県嬉野市嬉野町大字下野",
			want:        "長波須ハ丙",
		},
		{
			name:        "no overlap yields empty",
			beforeColon: "全然違う住所",
			matchedAddr: "佐賀県嬉野市嬉野町大字下野",
			want:        "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractUnmatchedPrefixFromBeforeColon(tt.beforeColon, tt.matchedAddr)
			if got != tt.want {
				t.Errorf("extractUnmatchedPrefixFromBeforeColon(%q, %q) = %q, want %q",
					tt.beforeColon, tt.matchedAddr, got, tt.want)
			}
		})
	}
}

func TestExtractUnmatchedWithAt(t *testing.T) {
	tests := []struct {
		searchAddr string
		want       string
	}{
		{"中央区入舟3@4-1", "4-1"},
		{"文京区大塚1@", ""},
		{"文京区大塚1", ""},
		{"", ""},
	}

	for _, tt := range tests {
		if got := extractUnmatchedWithAt(tt.searchAddr); got != tt.want {
			t.Errorf("extractUnmatchedWithAt(%q) = %q, want %q", tt.searchAddr, got, tt.want)
		}
	}
}

func TestExtractUnmatchedFromStandardized(t *testing.T) {
	tests := []struct {
		normalizedAddr string
		matchedAddr    string
		want           string
	}{
		{"愛知県清須市助七一", "愛知県清須市助七", "一"},
		{"愛知県清須市助七", "愛知県清須市助七", ""},
		{"東京都文京区大塚", "愛知県清須市助七", ""},
		{"", "愛知県清須市助七", ""},
	}

	for _, tt := range tests {
		if got := extractUnmatchedFromStandardized(tt.normalizedAddr, tt.matchedAddr); got != tt.want {
			t.Errorf("extractUnmatchedFromStandardized(%q, %q) = %q, want %q",
				tt.normalizedAddr, tt.matchedAddr, got, tt.want)
		}
	}
}

func TestExtractOriginalGoNumber(t *testing.T) {
	tests := []struct {
		originalAddr string
		want         string
		wantOK       bool
	}{
		{"北海道石狩市花川北一条一丁目一号", "一号", true},
		{"東京都港区虎ノ門1番23号", "23号", true},
		{"号", "", false},
		{"東京都港区虎ノ門", "", false},
	}

	for _, tt := range tests {
		got, ok := extractOriginalGoNumber(tt.originalAddr)
		if got != tt.want || ok != tt.wantOK {
			t.Errorf("extractOriginalGoNumber(%q) = (%q, %v), want (%q, %v)",
				tt.originalAddr, got, ok, tt.want, tt.wantOK)
		}
	}
}

func TestIsAllDigits(t *testing.T) {
	tests := []struct {
		s    string
		want bool
	}{
		{"123", true},
		{"0", true},
		{"", false},
		{"12a", false},
		{"１２３", false},
		{"1-2", false},
	}

	for _, tt := range tests {
		if got := isAllDigits(tt.s); got != tt.want {
			t.Errorf("isAllDigits(%q) = %v, want %v", tt.s, got, tt.want)
		}
	}
}

func TestSplitStandardizedAddress(t *testing.T) {
	tests := []struct {
		normalizedAddr string
		wantAddr       string
		wantBuilding   []string
	}{
		{"東京都中央区八丁堀4丁目12-7 サニービル4階D号", "東京都中央区八丁堀4丁目12-7", []string{"サニービル4階D号"}},
		{"渋谷区神宮前1-1 表参道ビル 3階 301号室", "渋谷区神宮前1-1", []string{"表参道ビル", "3階", "301号室"}},
		{"渋谷区神宮前1-1", "渋谷区神宮前1-1", []string{}},
		{"", "", []string{}},
	}

	for _, tt := range tests {
		gotAddr, gotBuilding := SplitStandardizedAddress(tt.normalizedAddr)
		if gotAddr != tt.wantAddr || !slices.Equal(gotBuilding, tt.wantBuilding) {
			t.Errorf("SplitStandardizedAddress(%q) = (%q, %v), want (%q, %v)",
				tt.normalizedAddr, gotAddr, gotBuilding, tt.wantAddr, tt.wantBuilding)
		}
	}
}

func TestExtractTrailingAddressNumbers(t *testing.T) {
	tests := []struct {
		searchAddr string
		want       string
	}{
		{"神戸市中央区磯上通8丁目3-5", "3-5"},
		{"千代田区紀尾井町1-3", "1-3"},
		{"千代田区紀尾井町", ""},
		{"", ""},
	}

	for _, tt := range tests {
		if got := ExtractTrailingAddressNumbers(tt.searchAddr); got != tt.want {
			t.Errorf("ExtractTrailingAddressNumbers(%q) = %q, want %q", tt.searchAddr, got, tt.want)
		}
	}
}
