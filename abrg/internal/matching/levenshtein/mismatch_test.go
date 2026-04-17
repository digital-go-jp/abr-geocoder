package levenshtein

import (
	"testing"

	"abrg/internal/model"
)

func TestHasChomeMismatch(t *testing.T) {
	tests := []struct {
		name        string
		searchAddr  string
		resultChome *string
		want        bool
	}{
		{
			name:        "nil chome",
			searchAddr:  "港区虎ノ門1@:2-3",
			resultChome: nil,
			want:        false,
		},
		{
			name:        "no @ in search",
			searchAddr:  "港区虎ノ門",
			resultChome: strPtr("1丁目"),
			want:        false,
		},
		{
			name:        "matching chome",
			searchAddr:  "港区虎ノ門1@:2-3",
			resultChome: strPtr("1丁目"),
			want:        false,
		},
		{
			name:        "mismatched chome",
			searchAddr:  "港区虎ノ門1@:2-3",
			resultChome: strPtr("2丁目"),
			want:        true,
		},
		{
			name:        "kanji chome in result",
			searchAddr:  "港区虎ノ門3@:2-3",
			resultChome: strPtr("三丁目"),
			want:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := hasChomeMismatch(tt.searchAddr, tt.resultChome); got != tt.want {
				t.Errorf("hasChomeMismatch(%q, %v) = %v, want %v", tt.searchAddr, tt.resultChome, got, tt.want)
			}
		})
	}
}

func TestHasTownNameMismatch(t *testing.T) {
	tests := []struct {
		name       string
		searchAddr string
		result     *model.MatchedResult
		want       bool
	}{
		{
			name:       "nil result",
			searchAddr: "天王寺区烏ヶ辻町74",
			result:     nil,
			want:       false,
		},
		{
			name:       "nil oaza_cho",
			searchAddr: "天王寺区烏ヶ辻町74",
			result: &model.MatchedResult{
				StructuredAddress: model.StructuredAddress{OazaCho: nil},
			},
			want: false,
		},
		{
			name:       "matching first char",
			searchAddr: "天王寺区烏ヶ辻町74",
			result: &model.MatchedResult{
				StructuredAddress: model.StructuredAddress{OazaCho: strPtr("烏ヶ辻町")},
			},
			want: false,
		},
		{
			// 先頭が同じでも途中で分岐する場合はmismatch
			// e.g., 神田鍛冶町 vs 神田猿楽町 (both start with 神田)
			name:       "shared prefix but different town",
			searchAddr: "千代田区神田鍛冶町2@:24",
			result: &model.MatchedResult{
				StructuredAddress: model.StructuredAddress{OazaCho: strPtr("神田猿楽町")},
			},
			want: true,
		},
		{
			name:       "mismatched first char",
			searchAddr: "天王寺区烏ヶ辻町74",
			result: &model.MatchedResult{
				StructuredAddress: model.StructuredAddress{OazaCho: strPtr("石ケ辻町")},
			},
			want: true,
		},
		{
			// 京都の通り名住所: KyotoStが設定されている場合はスキップ
			// 入力「西中筋通...丸屋町」の先頭「西」と OazaCho「丸屋町」の先頭「丸」は異なるが、
			// KyotoStがあるためmismatch判定しない
			name:       "kyoto street address - skip check",
			searchAddr: "下京区西中筋通北小路通上る丸屋町",
			result: &model.MatchedResult{
				StructuredAddress: model.StructuredAddress{
					KyotoSt: strPtr("西中筋通北小路上る"),
					OazaCho: strPtr("丸屋町"),
				},
			},
			want: false,
		},
		{
			// 京都以外で先頭文字が異なる場合はmismatch判定する
			name:       "non-kyoto mismatched first char",
			searchAddr: "中央区西町1-2-3",
			result: &model.MatchedResult{
				StructuredAddress: model.StructuredAddress{
					KyotoSt: nil,
					OazaCho: strPtr("東町"),
				},
			},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := hasTownNameMismatch(tt.searchAddr, tt.result); got != tt.want {
				t.Errorf("hasTownNameMismatch(%q) = %v, want %v", tt.searchAddr, got, tt.want)
			}
		})
	}
}

func TestExtractTownNameFromSearch(t *testing.T) {
	tests := []struct {
		name       string
		searchAddr string
		want       string
	}{
		{
			name:       "simple ward with town",
			searchAddr: "天王寺区烏ヶ辻町74",
			want:       "烏ヶ辻町",
		},
		{
			name:       "with @ pattern",
			searchAddr: "千代田区紀尾井町1@:3",
			want:       "紀尾井町",
		},
		{
			name:       "with colon pattern",
			searchAddr: "港区虎ノ門:1-2-3",
			want:       "虎ノ門",
		},
		{
			name:       "city with ward",
			searchAddr: "札幌市中央区北1条西2",
			want:       "北",
		},
		{
			name:       "no city marker",
			searchAddr: "烏ヶ辻町74",
			want:       "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := extractTownNameFromSearch(tt.searchAddr); got != tt.want {
				t.Errorf("extractTownNameFromSearch(%q) = %q, want %q", tt.searchAddr, got, tt.want)
			}
		})
	}
}

// strPtr is a helper function to create a pointer to a string.
func strPtr(s string) *string {
	return &s
}
