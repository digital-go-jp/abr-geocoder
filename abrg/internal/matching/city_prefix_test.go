package matching

import "testing"

func TestBuildCityPrefixMap(t *testing.T) {
	input := map[string]string{
		"京都市":  "26",
		"京田辺市": "26",
		"大阪市":  "27",
		"大津市":  "25",
	}
	m := buildCityPrefixMap(input)

	// "京都" bucket should have 京都市
	if bucket := m["京都"]; len(bucket) != 1 || bucket[0].city != "京都市" {
		t.Errorf("京都 bucket: got %v", bucket)
	}
	// "京田" bucket should have 京田辺市
	if bucket := m["京田"]; len(bucket) != 1 || bucket[0].city != "京田辺市" {
		t.Errorf("京田 bucket: got %v", bucket)
	}
	// "大阪" and "大津" should be separate buckets
	if bucket := m["大阪"]; len(bucket) != 1 {
		t.Errorf("大阪 bucket: got %v", bucket)
	}
	if bucket := m["大津"]; len(bucket) != 1 {
		t.Errorf("大津 bucket: got %v", bucket)
	}
}

func TestBuildCityPrefixMapNil(t *testing.T) {
	m := buildCityPrefixMap(nil)
	if m != nil {
		t.Error("expected nil for nil input")
	}
	m = buildCityPrefixMap(map[string]string{})
	if m != nil {
		t.Error("expected nil for empty input")
	}
}

func TestCityPrefixMapLookup(t *testing.T) {
	input := map[string]string{
		"京都市":  "26",
		"京田辺市": "26",
		"大阪市":  "27",
	}
	m := buildCityPrefixMap(input)

	tests := []struct {
		address string
		want    string
	}{
		{"京都市中京区寺町通", "26"},
		{"京田辺市草内", "26"},
		{"大阪市北区梅田", "27"},
		{"東京都千代田区", ""},
		{"不明", ""},
		{"", ""},
		{"あ", ""}, // less than 2 runes
	}
	for _, tt := range tests {
		got := m.lookup(tt.address)
		if got != tt.want {
			t.Errorf("lookup(%q) = %q, want %q", tt.address, got, tt.want)
		}
	}
}

func TestCityPrefixMapLookupNil(t *testing.T) {
	var m cityPrefixMap
	if got := m.lookup("京都市"); got != "" {
		t.Errorf("nil map lookup = %q, want empty", got)
	}
}

func BenchmarkCityPrefixMapLookup(b *testing.B) {
	// Build a realistic-size map
	cities := map[string]string{
		"京都市": "26", "大阪市": "27", "神戸市": "28",
		"横浜市": "14", "名古屋市": "23", "札幌市": "01",
		"福岡市": "40", "仙台市": "04", "広島市": "34",
		"千葉市": "12", "さいたま市": "11", "北九州市": "40",
	}
	m := buildCityPrefixMap(cities)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		m.lookup("大阪市北区梅田")
	}
}
