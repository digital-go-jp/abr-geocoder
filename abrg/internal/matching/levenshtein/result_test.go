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
			results:       []model.MatchedResult{{StructuredAddress: model.StructuredAddress{Koaza: strPtr("4号")}}},
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
				{StructuredAddress: model.StructuredAddress{Koaza: strPtr("1号")}},
				{StructuredAddress: model.StructuredAddress{Koaza: strPtr("4号")}},
			},
			searchNumbers: "4",
			wantNil:       false,
			wantKoaza:     "4号",
		},
		{
			name: "oaza_cho contains match",
			results: []model.MatchedResult{
				{StructuredAddress: model.StructuredAddress{OazaCho: strPtr("北11条西")}},
				{StructuredAddress: model.StructuredAddress{OazaCho: strPtr("北12条西")}},
			},
			searchNumbers: "11",
			wantNil:       false,
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
