package util

import "testing"

func TestStripChomeSuffix(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "remove 丁目 suffix",
			input: "一丁目",
			want:  "一",
		},
		{
			name:  "remove 丁 suffix",
			input: "一丁",
			want:  "一",
		},
		{
			name:  "numeric with 丁目",
			input: "1丁目",
			want:  "1",
		},
		{
			name:  "numeric with 丁",
			input: "1丁",
			want:  "1",
		},
		{
			name:  "no suffix to remove",
			input: "一",
			want:  "一",
		},
		{
			name:  "empty string",
			input: "",
			want:  "",
		},
		{
			name:  "string with 丁 in middle",
			input: "八丁堀",
			want:  "八丁堀",
		},
		{
			name:  "string ending with 丁目 but different context",
			input: "八丁堀四丁目",
			want:  "八丁堀四",
		},
		{
			name:  "kanji number with 丁目",
			input: "四丁目",
			want:  "四",
		},
		{
			name:  "two digit number with 丁目",
			input: "12丁目",
			want:  "12",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := StripChomeSuffix(tt.input)
			if got != tt.want {
				t.Errorf("StripChomeSuffix(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestStripGoSuffix(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "remove 号 suffix",
			input: "4号",
			want:  "4",
		},
		{
			name:  "no suffix to remove",
			input: "5",
			want:  "5",
		},
		{
			name:  "empty string",
			input: "",
			want:  "",
		},
		{
			name:  "kanji number with 号",
			input: "四号",
			want:  "四",
		},
		{
			name:  "two digit number with 号",
			input: "12号",
			want:  "12",
		},
		{
			name:  "string with 号 in middle",
			input: "1号棟",
			want:  "1号棟",
		},
		{
			name:  "only 号",
			input: "号",
			want:  "",
		},
		{
			name:  "remove 字 suffix",
			input: "10字",
			want:  "10",
		},
		{
			name:  "kanji number with 字",
			input: "壱〇字",
			want:  "壱〇",
		},
		{
			name:  "only 字",
			input: "字",
			want:  "",
		},
		{
			name:  "string with 字 in middle",
			input: "大字田中",
			want:  "大字田中",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := StripGoSuffix(tt.input)
			if got != tt.want {
				t.Errorf("StripGoSuffix(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
