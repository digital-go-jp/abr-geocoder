package util

import "testing"

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
