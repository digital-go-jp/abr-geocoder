package normalize

import (
	"errors"
	"strings"
	"testing"
)

func TestBasicNormalizeInput(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr error
	}{
		{name: "address", input: "東京都千代田区紀尾井町１番３号", want: "東京都千代田区紀尾井町1番3号"},
		{name: "address with a comment", input: "東京都千代田区紀尾井町1-3 // 本社", want: "東京都千代田区紀尾井町1-3"},
		{name: "empty", input: "", wantErr: ErrEmptyAddress},
		{name: "whitespace only", input: " \t\u3000", wantErr: ErrEmptyAddress},
		{name: "line comment only", input: "// memo", wantErr: ErrEmptyAddress},
		{name: "block comment only", input: "/* memo */", wantErr: ErrEmptyAddress},
		{name: "quotes only", input: `""`, wantErr: ErrEmptyAddress},
		{name: "BOM only", input: "\uFEFF", wantErr: ErrEmptyAddress},
		{name: "longest address", input: strings.Repeat("あ", MaxAddressLength), want: strings.Repeat("あ", MaxAddressLength)},
		{name: "address too long", input: strings.Repeat("あ", MaxAddressLength+1), wantErr: ErrAddressTooLong},
		{
			name:  "comment does not count toward the length",
			input: "東京都千代田区紀尾井町1-3 // " + strings.Repeat("あ", MaxAddressLength),
			want:  "東京都千代田区紀尾井町1-3",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := BasicNormalizeInput(tt.input)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("BasicNormalizeInput(%q) error = %v, want %v", tt.input, err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("BasicNormalizeInput(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
