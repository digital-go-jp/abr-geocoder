package levenshtein

import (
	"testing"

	"abrg/internal/model"
)

// TestJaccardSimilarity tests the jaccardSimilarity function
func TestJaccardSimilarity(t *testing.T) {
	tests := []struct {
		name string
		s1   string
		s2   string
		want float64
	}{
		{
			name: "Identical strings",
			s1:   "八の坪",
			s2:   "八の坪",
			want: 1.0,
		},
		{
			name: "Empty strings",
			s1:   "",
			s2:   "",
			want: 1.0,
		},
		{
			name: "One empty string",
			s1:   "abc",
			s2:   "",
			want: 0.0,
		},
		{
			name: "Single character strings",
			s1:   "a",
			s2:   "b",
			want: 0.0,
		},
		{
			name: "Completely different",
			s1:   "abc",
			s2:   "xyz",
			want: 0.0,
		},
		{
			name: "Kanji vs Arabic numeral - different",
			s1:   "八の坪",
			s2:   "8の坪",
			want: 0.33, // intersection=1 ("の坪"), union=3 ("八の","の坪","8の") → 1/3 ≈ 0.33
		},
		{
			name: "Similar strings",
			s1:   "abcd",
			s2:   "abce",
			want: 0.5, // "ab", "bc" common; "cd" vs "ce" different
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := jaccardSimilarity(tt.s1, tt.s2)
			// Allow small floating point tolerance
			if got < tt.want-0.01 || got > tt.want+0.01 {
				t.Errorf("jaccardSimilarity(%q, %q) = %v, want %v", tt.s1, tt.s2, got, tt.want)
			}
		})
	}
}

// TestSelectBestByJaccard tests the SelectBestByJaccard function
func TestSelectBestByJaccard(t *testing.T) {
	// Helper to create string pointer
	strPtr := func(s string) *string { return &s }

	tests := []struct {
		name         string
		results      []model.MatchedResult
		originalAddr string
		wantKoaza    string
	}{
		{
			name: "Select kanji version for kanji input",
			results: []model.MatchedResult{
				{
					MatchedAddress: "佐賀県神埼市千代田町渡瀬8の坪",
					StructuredAddress: model.StructuredAddress{
						Pref:    strPtr("佐賀県"),
						City:    strPtr("神埼市"),
						OazaCho: strPtr("千代田町渡瀬"),
						Koaza:   strPtr("8の坪"),
					},
				},
				{
					MatchedAddress: "佐賀県神埼市千代田町渡瀬八の坪",
					StructuredAddress: model.StructuredAddress{
						Pref:    strPtr("佐賀県"),
						City:    strPtr("神埼市"),
						OazaCho: strPtr("千代田町渡瀬"),
						Koaza:   strPtr("八の坪"),
					},
				},
			},
			originalAddr: "佐賀県神埼市千代田町渡瀬八の坪",
			wantKoaza:    "八の坪",
		},
		{
			name: "Select Arabic version for Arabic input",
			results: []model.MatchedResult{
				{
					MatchedAddress: "佐賀県神埼市千代田町渡瀬八の坪",
					StructuredAddress: model.StructuredAddress{
						Pref:    strPtr("佐賀県"),
						City:    strPtr("神埼市"),
						OazaCho: strPtr("千代田町渡瀬"),
						Koaza:   strPtr("八の坪"),
					},
				},
				{
					MatchedAddress: "佐賀県神埼市千代田町渡瀬8の坪",
					StructuredAddress: model.StructuredAddress{
						Pref:    strPtr("佐賀県"),
						City:    strPtr("神埼市"),
						OazaCho: strPtr("千代田町渡瀬"),
						Koaza:   strPtr("8の坪"),
					},
				},
			},
			originalAddr: "佐賀県神埼市千代田町渡瀬8の坪",
			wantKoaza:    "8の坪",
		},
		{
			name: "Single result returns as-is",
			results: []model.MatchedResult{
				{
					MatchedAddress: "佐賀県神埼市千代田町渡瀬8の坪",
					StructuredAddress: model.StructuredAddress{
						Pref:    strPtr("佐賀県"),
						City:    strPtr("神埼市"),
						OazaCho: strPtr("千代田町渡瀬"),
						Koaza:   strPtr("8の坪"),
					},
				},
			},
			originalAddr: "佐賀県神埼市千代田町渡瀬八の坪",
			wantKoaza:    "8の坪",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SelectBestByJaccard(tt.results, tt.originalAddr)
			if len(got) != 1 {
				t.Fatalf("SelectBestByJaccard returned %d results, want 1", len(got))
			}
			if got[0].StructuredAddress.Koaza == nil {
				t.Fatal("SelectBestByJaccard returned result with nil Koaza")
			}
			if *got[0].StructuredAddress.Koaza != tt.wantKoaza {
				t.Errorf("SelectBestByJaccard() koaza = %q, want %q", *got[0].StructuredAddress.Koaza, tt.wantKoaza)
			}
		})
	}
}

// TestBuildMatchedAddress tests the buildMatchedAddress function
func TestBuildMatchedAddress(t *testing.T) {
	strPtr := func(s string) *string { return &s }

	tests := []struct {
		name   string
		result model.MatchedResult
		want   string
	}{
		{
			name: "Full address with all components",
			result: model.MatchedResult{
				StructuredAddress: model.StructuredAddress{
					Pref:    strPtr("佐賀県"),
					City:    strPtr("神埼市"),
					OazaCho: strPtr("千代田町渡瀬"),
					Koaza:   strPtr("八の坪"),
				},
			},
			want: "佐賀県神埼市千代田町渡瀬八の坪",
		},
		{
			name: "Address without koaza",
			result: model.MatchedResult{
				StructuredAddress: model.StructuredAddress{
					Pref:    strPtr("東京都"),
					City:    strPtr("千代田区"),
					OazaCho: strPtr("永田町"),
				},
			},
			want: "東京都千代田区永田町",
		},
		{
			name: "Address with ward",
			result: model.MatchedResult{
				StructuredAddress: model.StructuredAddress{
					Pref:    strPtr("大阪府"),
					City:    strPtr("大阪市"),
					Ward:    strPtr("中央区"),
					OazaCho: strPtr("難波"),
				},
			},
			want: "大阪府大阪市中央区難波",
		},
		{
			name: "Address with chome",
			result: model.MatchedResult{
				StructuredAddress: model.StructuredAddress{
					Pref:    strPtr("東京都"),
					City:    strPtr("新宿区"),
					OazaCho: strPtr("西新宿"),
					Chome:   strPtr("2丁目"),
				},
			},
			want: "東京都新宿区西新宿2丁目",
		},
		{
			name: "Address with KyotoSt",
			result: model.MatchedResult{
				StructuredAddress: model.StructuredAddress{
					Pref:    strPtr("京都府"),
					City:    strPtr("京都市"),
					Ward:    strPtr("中京区"),
					KyotoSt: strPtr("寺町通御池上る"),
					OazaCho: strPtr("上本能寺前町"),
				},
			},
			want: "京都府京都市中京区寺町通御池上る上本能寺前町",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := buildMatchedAddress(&tt.result)
			if got != tt.want {
				t.Errorf("buildMatchedAddress() = %q, want %q", got, tt.want)
			}
		})
	}
}
