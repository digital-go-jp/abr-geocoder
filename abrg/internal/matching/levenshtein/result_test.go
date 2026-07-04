package levenshtein

import (
	"testing"

	"abrg/internal/model"
)

func TestExtractSearchNumbers(t *testing.T) {
	tests := []struct {
		name       string
		searchAddr string
		want       string
	}{
		{
			name:       "with colon",
			searchAddr: "港区虎ノ門:1-23-1",
			want:       "1-23-1",
		},
		{
			name:       "trailing numbers",
			searchAddr: "港区虎ノ門1-23-1",
			want:       "1-23-1",
		},
		{
			name:       "no numbers",
			searchAddr: "港区虎ノ門",
			want:       "",
		},
		{
			name:       "empty string",
			searchAddr: "",
			want:       "",
		},
		{
			name:       "colon only",
			searchAddr: "港区虎ノ門:",
			want:       "",
		},
		{
			name:       "trailing number with 号 suffix",
			searchAddr: "南丹市園部町河原町4号",
			want:       "4",
		},
		{
			name:       "trailing number with hyphen and 号 suffix",
			searchAddr: "南丹市園部町河原町1-2号",
			want:       "1-2",
		},
		{
			name:       "号 suffix without trailing number",
			searchAddr: "南丹市園部町河原町号",
			want:       "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ExtractSearchNumbers(tt.searchAddr); got != tt.want {
				t.Errorf("ExtractSearchNumbers(%q) = %q, want %q", tt.searchAddr, got, tt.want)
			}
		})
	}
}

func TestShouldSkipBasicCategory(t *testing.T) {
	tests := []struct {
		name          string
		category      model.Category
		searchAddr    string
		searchNumbers string
		stdAddress    string
		want          bool
	}{
		{
			name:          "not basic category",
			category:      model.CategoryParcel,
			searchAddr:    "港区虎ノ門",
			searchNumbers: "",
			stdAddress:    "港区虎ノ門1@",
			want:          false,
		},
		{
			name:          "search has @",
			category:      model.CategoryBasic,
			searchAddr:    "港区虎ノ門1@",
			searchNumbers: "",
			stdAddress:    "港区虎ノ門1@",
			want:          false,
		},
		{
			name:          "search has numbers",
			category:      model.CategoryBasic,
			searchAddr:    "港区虎ノ門",
			searchNumbers: "1-2-3",
			stdAddress:    "港区虎ノ門1@",
			want:          false,
		},
		{
			name:          "result has no @",
			category:      model.CategoryBasic,
			searchAddr:    "港区虎ノ門",
			searchNumbers: "",
			stdAddress:    "港区虎ノ門",
			want:          false,
		},
		{
			name:          "should skip - no search @ or numbers, result has @",
			category:      model.CategoryBasic,
			searchAddr:    "港区虎ノ門",
			searchNumbers: "",
			stdAddress:    "港区虎ノ門1@",
			want:          true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := shouldSkipBasicCategory(tt.category, tt.searchAddr, tt.searchNumbers, tt.stdAddress); got != tt.want {
				t.Errorf("shouldSkipBasicCategory() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCollectSameScoreResults(t *testing.T) {
	results := []model.MatchedResult{
		{Score: 0.9, MatchedAddress: "addr1"},
		{Score: 0.9, MatchedAddress: "addr2"},
		{Score: 0.8, MatchedAddress: "addr3"},
		{Score: 0.7, MatchedAddress: "addr4"},
	}

	tests := []struct {
		name     string
		topScore float64
		wantLen  int
	}{
		{
			name:     "two results with same top score",
			topScore: 0.9,
			wantLen:  2,
		},
		{
			name:     "one result with different top score",
			topScore: 0.8,
			wantLen:  1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Reset results slice for different top scores test
			testResults := results
			if tt.topScore == 0.8 {
				testResults = results[2:] // start from score 0.8
			}
			got := collectSameScoreResults(testResults, tt.topScore)
			if len(got) != tt.wantLen {
				t.Errorf("collectSameScoreResults() returned %d results, want %d", len(got), tt.wantLen)
			}
		})
	}
}

func TestSelectBySearchNumbers(t *testing.T) {
	tests := []struct {
		name          string
		results       []model.MatchedResult
		searchNumbers string
		wantNil       bool
		wantKoaza     string
	}{
		{
			name:          "empty searchNumbers",
			results:       []model.MatchedResult{{StructuredAddress: model.StructuredAddress{Koaza: new("4号")}}},
			searchNumbers: "",
			wantNil:       true,
		},
		{
			name:          "empty results",
			results:       []model.MatchedResult{},
			searchNumbers: "4",
			wantNil:       true,
		},
		{
			name: "koaza prefix match",
			results: []model.MatchedResult{
				{StructuredAddress: model.StructuredAddress{Koaza: new("1号")}},
				{StructuredAddress: model.StructuredAddress{Koaza: new("4号")}},
			},
			searchNumbers: "4",
			wantNil:       false,
			wantKoaza:     "4号",
		},
		{
			name: "oaza_cho contains match",
			results: []model.MatchedResult{
				{StructuredAddress: model.StructuredAddress{OazaCho: new("北11条西")}},
				{StructuredAddress: model.StructuredAddress{OazaCho: new("北12条西")}},
			},
			searchNumbers: "11",
			wantNil:       false,
		},
		{
			// koaza contains searchNumbers but does not start with it -> weaker
			// (contains) score, still selected over a non-matching candidate.
			name: "koaza contains but not prefix",
			results: []model.MatchedResult{
				{StructuredAddress: model.StructuredAddress{Koaza: new("12号")}},
				{StructuredAddress: model.StructuredAddress{Koaza: new("99号")}},
			},
			searchNumbers: "2",
			wantNil:       false,
			wantKoaza:     "12号",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := selectBySearchNumbers(tt.results, tt.searchNumbers)
			if tt.wantNil {
				if got != nil {
					t.Errorf("selectBySearchNumbers() = %v, want nil", got)
				}
				return
			}
			if got == nil {
				t.Errorf("selectBySearchNumbers() = nil, want non-nil")
				return
			}
			if tt.wantKoaza != "" && got.StructuredAddress.Koaza != nil && *got.StructuredAddress.Koaza != tt.wantKoaza {
				t.Errorf("selectBySearchNumbers() koaza = %q, want %q", *got.StructuredAddress.Koaza, tt.wantKoaza)
			}
		})
	}
}

func TestSelectBestFromTiedResults(t *testing.T) {
	tests := []struct {
		name          string
		results       []model.MatchedResult
		searchNumbers string
		originalAddr  string
		wantLen       int
	}{
		{
			name:          "single result",
			results:       []model.MatchedResult{{Score: 0.9}},
			searchNumbers: "",
			originalAddr:  "",
			wantLen:       1,
		},
		{
			name:          "empty results",
			results:       []model.MatchedResult{},
			searchNumbers: "",
			originalAddr:  "",
			wantLen:       0,
		},
		{
			name: "different scores - no tie",
			results: []model.MatchedResult{
				{Score: 0.9, MatchedAddress: "addr1"},
				{Score: 0.8, MatchedAddress: "addr2"},
			},
			searchNumbers: "",
			originalAddr:  "",
			wantLen:       2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := selectBestFromTiedResults(tt.results, tt.searchNumbers, tt.originalAddr)
			if len(got) != tt.wantLen {
				t.Errorf("selectBestFromTiedResults() returned %d results, want %d", len(got), tt.wantLen)
			}
		})
	}
}

func TestSelectBestFromTiedResults_TieBreaking(t *testing.T) {
	t.Run("searchNumbers picks matching koaza and preserves lower-scored remainder", func(t *testing.T) {
		results := []model.MatchedResult{
			{Score: 0.9, MatchedAddress: "A", StructuredAddress: model.StructuredAddress{Koaza: new("1号")}},
			{Score: 0.9, MatchedAddress: "B", StructuredAddress: model.StructuredAddress{Koaza: new("4号")}},
			{Score: 0.8, MatchedAddress: "C"},
		}
		got := selectBestFromTiedResults(results, "4", "")
		if len(got) != 2 {
			t.Fatalf("len = %d, want 2", len(got))
		}
		if got[0].MatchedAddress != "B" {
			t.Errorf("got[0].MatchedAddress = %q, want \"B\" (koaza 4号)", got[0].MatchedAddress)
		}
		if got[1].MatchedAddress != "C" {
			t.Errorf("got[1].MatchedAddress = %q, want \"C\" (remainder preserved)", got[1].MatchedAddress)
		}
	})

	t.Run("jaccard fallback picks closest oaza and preserves remainder", func(t *testing.T) {
		results := []model.MatchedResult{
			{Score: 0.9, MatchedAddress: "X", StructuredAddress: model.StructuredAddress{OazaCho: new("大一本松")}},
			{Score: 0.9, MatchedAddress: "Y", StructuredAddress: model.StructuredAddress{OazaCho: new("大1本松")}},
			{Score: 0.7, MatchedAddress: "Z"},
		}
		got := selectBestFromTiedResults(results, "", "大一本松")
		if len(got) != 2 {
			t.Fatalf("len = %d, want 2", len(got))
		}
		if got[0].MatchedAddress != "X" {
			t.Errorf("got[0].MatchedAddress = %q, want \"X\" (jaccard closest)", got[0].MatchedAddress)
		}
		if got[1].MatchedAddress != "Z" {
			t.Errorf("got[1].MatchedAddress = %q, want \"Z\" (remainder preserved)", got[1].MatchedAddress)
		}
	})
}

func TestIsPartialKoazaMatch(t *testing.T) {
	tests := []struct {
		name       string
		searchAddr string
		stdAddress string
		want       bool
	}{
		{
			name:       "trailing digits are a house number, koaza adds non-digit suffix",
			searchAddr: "加賀市大聖寺上木町95",
			stdAddress: "加賀市大聖寺上木町95ノ",
			want:       true,
		},
		{
			name:       "exact match is not a partial match",
			searchAddr: "加賀市大聖寺上木町95ノ",
			stdAddress: "加賀市大聖寺上木町95ノ",
			want:       false,
		},
		{
			name:       "extra suffix contains a digit",
			searchAddr: "加賀市大聖寺上木町95",
			stdAddress: "加賀市大聖寺上木町95の2",
			want:       false,
		},
		{
			name:       "searchAddr does not end with a digit",
			searchAddr: "加賀市大聖寺上木町",
			stdAddress: "加賀市大聖寺上木町95",
			want:       false,
		},
		{
			name:       "stdAddress is not a prefix of searchAddr base",
			searchAddr: "東京",
			stdAddress: "大阪府東京",
			want:       false,
		},
		{
			name:       "empty searchAddr",
			searchAddr: "",
			stdAddress: "加賀市",
			want:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isPartialKoazaMatch(tt.searchAddr, tt.stdAddress); got != tt.want {
				t.Errorf("isPartialKoazaMatch(%q, %q) = %v, want %v", tt.searchAddr, tt.stdAddress, got, tt.want)
			}
		})
	}
}

func TestIsFalseChomeMatch(t *testing.T) {
	tests := []struct {
		name       string
		searchAddr string
		stdAddress string
		want       bool
	}{
		{
			// 一ノ山 became "1ノ山" via kanji-to-arabic; that "1" is part of a place
			// name, so matching "久保田1@" (久保田1丁目) would be a false chome match.
			name:       "digit from place name is not a chome",
			searchAddr: "久保田1ノ山:1523",
			stdAddress: "久保田1@",
			want:       true,
		},
		{
			name:       "digit is a real chome number",
			searchAddr: "久保田1:23",
			stdAddress: "久保田1@",
			want:       false,
		},
		{
			name:       "searchAddr already has a chome marker",
			searchAddr: "久保田1@:23",
			stdAddress: "久保田1@",
			want:       false,
		},
		{
			name:       "stdAddress has no chome marker",
			searchAddr: "久保田1:23",
			stdAddress: "久保田1",
			want:       false,
		},
		{
			name:       "no digit before the chome marker",
			searchAddr: "久保田:1",
			stdAddress: "久保田@",
			want:       false,
		},
		{
			name:       "searchAddr base equals oaza exactly",
			searchAddr: "久保田:5",
			stdAddress: "久保田1@",
			want:       false,
		},
		{
			name:       "searchAddr base does not start with oaza",
			searchAddr: "別町:1",
			stdAddress: "久保田1@",
			want:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isFalseChomeMatch(tt.searchAddr, tt.stdAddress); got != tt.want {
				t.Errorf("isFalseChomeMatch(%q, %q) = %v, want %v", tt.searchAddr, tt.stdAddress, got, tt.want)
			}
		})
	}
}
