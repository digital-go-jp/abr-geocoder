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

func TestCityBoundaryFind(t *testing.T) {
	// A representative slice of the real cache_city boundary set (city+ward and
	// county+city+ward forms), including cities whose name contains a mid-string
	// 市/町/村 marker.
	cb := NewCityBoundary([]string{
		"市川市", "町田市", "市原市", "東村山市", "武蔵村山市", "四日市市",
		"あきる野市", "東近江市", "日光市", "田村市", "村田町",
		"大阪市天王寺区", "横浜市港北区", "涌谷町", "遠田郡涌谷町", "港区",
	})

	tests := []struct {
		name string
		addr string
		want int
	}{
		// Dictionary longest-match fixes the mid-string-marker cities (#243).
		{"mid marker 市川市", "市川市八幡1-1", len("市川市")},
		{"mid marker 町田市 + town", "町田市中町", len("町田市")},
		{"mid marker 市原市", "市原市五井", len("市原市")},
		{"mid marker 東村山市", "東村山市本町2", len("東村山市")},
		{"bare 東村山市", "東村山市", len("東村山市")},
		// Oaza that ends in 市 must NOT be absorbed (it is not a city name).
		{"oaza 五日市 not absorbed", "あきる野市五日市", len("あきる野市")},
		{"oaza 八日市 not absorbed", "東近江市八日市町", len("東近江市")},
		{"oaza 今市 not absorbed", "日光市今市", len("日光市")},
		// Real cities that legitimately contain 日/村 etc.
		{"四日市市 itself", "四日市市諏訪町", len("四日市市")},
		{"田村市 + town", "田村市船引町", len("田村市")},
		// Designated-city ward and county forms.
		{"seireishi ward", "大阪市天王寺区烏ヶ辻町", len("大阪市天王寺区")},
		{"county+town", "遠田郡涌谷町字前", len("遠田郡涌谷町")},
		{"town without county", "涌谷町字前", len("涌谷町")},
		// No dictionary match -> heuristic fallback (prefecture-prefixed input).
		{"pref-prefixed falls back to heuristic", "東京都千代田区紀尾井町", len("東京都千代田区")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := cb.Find(tt.addr); got != tt.want {
				t.Errorf("Find(%q) = %d, want %d", tt.addr, got, tt.want)
			}
		})
	}

	// A nil matcher must fall back to the heuristic (used when no cache is loaded).
	t.Run("nil matcher falls back", func(t *testing.T) {
		var nilCB *CityBoundary
		if got := nilCB.Find("大阪市天王寺区烏ヶ辻町"); got != len("大阪市天王寺区") {
			t.Errorf("nil Find = %d, want %d", got, len("大阪市天王寺区"))
		}
	})
}
