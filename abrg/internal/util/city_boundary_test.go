package util

import "testing"

func TestIsCityMarker(t *testing.T) {
	tests := []struct {
		ch   rune
		want bool
	}{
		{'区', true},
		{'市', true},
		{'町', true},
		{'村', true},
		{'県', false},
		{'都', false},
		{'道', false},
		{'府', false},
		{'丁', false},
		{'あ', false},
	}

	for _, tt := range tests {
		t.Run(string(tt.ch), func(t *testing.T) {
			if got := isCityMarker(tt.ch); got != tt.want {
				t.Errorf("isCityMarker(%q) = %v, want %v", tt.ch, got, tt.want)
			}
		})
	}
}

func TestFindCityBoundary(t *testing.T) {
	tests := []struct {
		name string
		addr string
		want int
	}{
		{
			name: "simple ward",
			addr: "東京都千代田区紀尾井町",
			want: len("東京都千代田区"),
		},
		{
			name: "city with ward",
			addr: "大阪市天王寺区烏ヶ辻町",
			want: len("大阪市天王寺区"),
		},
		{
			name: "city only",
			addr: "横浜市港北区",
			want: len("横浜市港北区"),
		},
		{
			name: "town",
			addr: "神奈川県足柄下郡箱根町",
			want: len("神奈川県足柄下郡箱根町"),
		},
		{
			name: "village",
			addr: "沖縄県中頭郡読谷村",
			want: len("沖縄県中頭郡読谷村"),
		},
		{
			name: "no marker",
			addr: "東京都",
			want: -1,
		},
		{
			name: "empty string",
			addr: "",
			want: -1,
		},
		{
			name: "sapporo city with ward",
			addr: "北海道札幌市中央区",
			want: len("北海道札幌市中央区"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := FindCityBoundary(tt.addr); got != tt.want {
				t.Errorf("FindCityBoundary(%q) = %v, want %v", tt.addr, got, tt.want)
			}
		})
	}
}
