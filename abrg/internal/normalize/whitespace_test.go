package normalize

import (
	"testing"
)

func TestNormalizeSpaces(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		{
			name:     "前後のスペースを削除",
			input:    "  東京都港区三田  ",
			expected: "東京都港区三田",
			changed:  true,
		},
		{
			name:     "前後のタブを削除",
			input:    "\t\t東京都港区三田\t\t",
			expected: "東京都港区三田",
			changed:  true,
		},
		{
			name:     "前後の改行を削除",
			input:    "\n\n東京都港区三田\n\n",
			expected: "東京都港区三田",
			changed:  true,
		},
		{
			name:     "前後のキャリッジリターンを削除",
			input:    "\r\r東京都港区三田\r\r",
			expected: "東京都港区三田",
			changed:  true,
		},
		{
			name:     "中間の連続スペースを1つに",
			input:    "東京都　　港区　　　三田",
			expected: "東京都 港区 三田",
			changed:  true,
		},
		{
			name:     "中間の連続タブを1つのスペースに",
			input:    "東京都\t\t港区\t\t\t三田",
			expected: "東京都 港区 三田",
			changed:  true,
		},
		{
			name:     "中間のタブとスペースの混在を1つのスペースに",
			input:    "東京都\t  \t港区　\t　三田",
			expected: "東京都 港区 三田",
			changed:  true,
		},
		{
			name:     "垂直タブとフォームフィードも処理",
			input:    "東京都\v\v港区\f\f三田",
			expected: "東京都 港区 三田",
			changed:  true,
		},
		{
			name:     "前後と中間の混在処理",
			input:    "  \t東京都\t\t港区　　三田\n\n",
			expected: "東京都 港区 三田",
			changed:  true,
		},
		{
			name:     "改行を含む連続空白を1つのスペースに",
			input:    "東京都\n\n港区\n三田",
			expected: "東京都 港区 三田",
			changed:  true,
		},
		{
			name:     "キャリッジリターンを含む連続空白を1つのスペースに",
			input:    "東京都\r\r港区\r三田",
			expected: "東京都 港区 三田",
			changed:  true,
		},
		{
			name:     "CRLF（Windows改行）を含む連続空白を1つのスペースに",
			input:    "東京都\r\n\r\n港区\r\n三田",
			expected: "東京都 港区 三田",
			changed:  true,
		},
		{
			name:     "全角スペースも処理",
			input:    "　　東京都　　港区　　三田　　",
			expected: "東京都 港区 三田",
			changed:  true,
		},
		{
			name:     "全角スペースのみ",
			input:    "　",
			expected: "",
			changed:  true,
		},
		{
			name:     "Unicode空白文字（NBSP, EM SPACE等）",
			input:    "東京都\u00A0港区\u2003三田",
			expected: "東京都 港区 三田",
			changed:  true,
		},
		{
			name:     "空文字列",
			input:    "",
			expected: "",
			changed:  false,
		},
		{
			name:     "空白のみの文字列",
			input:    "  \t\n　　",
			expected: "",
			changed:  true,
		},
		{
			name:     "空白なしの住所（変更なし）",
			input:    "東京都港区三田3-3-3",
			expected: "東京都港区三田3-3-3",
			changed:  false,
		},
		{
			name:     "建物名付き住所の空白正規化",
			input:    "東京都港区三田3-3-3　　三田ビル　　304号室",
			expected: "東京都港区三田3-3-3 三田ビル 304号室",
			changed:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, changed := NormalizeSpaces(tt.input)
			if got != tt.expected {
				t.Errorf("NormalizeSpaces() = %v, want %v", got, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("NormalizeSpaces() changed = %v, want %v", changed, tt.changed)
			}
		})
	}
}

func BenchmarkNormalizeSpaces(b *testing.B) {
	testCases := []string{
		"  東京都　　港区　　三田  ",
		"東京都\t\t港区\t\t\t三田",
		"東京都港区三田3-3-3　　三田ビル　　101号室",
		"東京都港区三田", // 空白なしのケース
	}

	b.ResetTimer()
	for b.Loop() {
		for _, tc := range testCases {
			NormalizeSpaces(tc)
		}
	}
}
