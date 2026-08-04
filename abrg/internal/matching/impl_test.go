package matching

import (
	"context"
	"errors"
	"testing"

	"abrg/internal/cache"
	"abrg/internal/model"
	"abrg/internal/repository"
	"abrg/internal/transform"

	"abrg/internal/matchlevel"
)

func Test_derefString(t *testing.T) {
	tests := []struct {
		name     string
		input    *string
		expected string
	}{
		{"nil returns empty", nil, ""},
		{"non-nil returns value", new("hello"), "hello"},
		{"empty string returns empty", new(""), ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := derefString(tt.input); got != tt.expected {
				t.Errorf("derefString() = %q, want %q", got, tt.expected)
			}
		})
	}
}

func TestMatchLevelToDetail(t *testing.T) {
	tests := []struct {
		name     string
		level    model.MatchLevel
		expected int
	}{
		{"residential detail", model.MatchLevelResidentialDetail, 7},
		{"residential block", model.MatchLevelResidentialBlock, 6},
		{"parcel", model.MatchLevelParcel, 5},
		{"machiaza detail", model.MatchLevelMachiazaDetail, 4},
		{"machiaza", model.MatchLevelMachiaza, 3},
		{"city", model.MatchLevelCity, 2},
		{"prefecture", model.MatchLevelPrefecture, 1},
		{"unknown", model.MatchLevel("unknown"), 0},
		{"empty", model.MatchLevel(""), 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := matchlevel.Detail(tt.level); got != tt.expected {
				t.Errorf("matchlevel.Detail(%q) = %d, want %d", tt.level, got, tt.expected)
			}
		})
	}
}

func TestAdjustSearchAddrForMatch(t *testing.T) {
	tests := []struct {
		name       string
		searchAddr string
		source     *string
		expected   string
	}{
		// nil source
		{"nil source", "港区虎ノ門:1-23-1", nil, "港区虎ノ門:1-23-1"},
		// source with no number
		{"source no number", "港区虎ノ門:1-23-1", new("あいう"), "港区虎ノ門:1-23-1"},
		// @ pattern matching
		{"@ pattern match", "入舟3@:4-1", new("3丁目"), "入舟:4-1"},
		{"@ pattern no match", "入舟3@:4-1", new("2丁目"), "入舟3@:4-1"},
		// colon pattern matching
		{"colon pattern match", "港区虎ノ門:1-23-1", new("1丁目"), "港区虎ノ門:23-1"},
		{"colon pattern no match", "港区虎ノ門:1-23-1", new("2丁目"), "港区虎ノ門:1-23-1"},
		// no colon
		{"no colon", "港区虎ノ門", new("1丁目"), "港区虎ノ門"},
		// empty after colon (trailing colon is dropped by parsedAddress.String())
		{"empty after colon", "港区虎ノ門:", new("1丁目"), "港区虎ノ門"},
		// match removes all remaining
		{"match removes all", "港区虎ノ門:1", new("1丁目"), "港区虎ノ門"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := adjustSearchAddrForMatch(parseSearchAddr(tt.searchAddr), tt.source); got != tt.expected {
				t.Errorf("adjustSearchAddrForMatch(%q, %v) = %q, want %q", tt.searchAddr, tt.source, got, tt.expected)
			}
		})
	}
}

func TestBuildCityBasedSearchAddr(t *testing.T) {
	tests := []struct {
		name            string
		addr            model.StructuredAddress
		chomeSearchAddr string
		expected        string
	}{
		{
			name:            "empty city prefix",
			addr:            model.StructuredAddress{},
			chomeSearchAddr: "静岡県下田市2@:4-26",
			expected:        "静岡県下田市2@:4-26",
		},
		{
			name: "city found in searchAddr",
			addr: model.StructuredAddress{
				City: new("下田市"),
			},
			chomeSearchAddr: "静岡県下田市2@:4-26",
			expected:        "下田市2@:4-26",
		},
		{
			name: "city with ward",
			addr: model.StructuredAddress{
				City: new("横浜市"),
				Ward: new("中区"),
			},
			chomeSearchAddr: "神奈川県横浜市中区本町:1-2",
			expected:        "横浜市中区本町:1-2",
		},
		{
			name: "county + city",
			addr: model.StructuredAddress{
				County: new("西多摩郡"),
				City:   new("日の出町"),
			},
			chomeSearchAddr: "東京都西多摩郡日の出町大字平井:123",
			expected:        "西多摩郡日の出町大字平井:123",
		},
		{
			name: "city not found",
			addr: model.StructuredAddress{
				City: new("不明市"),
			},
			chomeSearchAddr: "静岡県下田市2@:4-26",
			expected:        "静岡県下田市2@:4-26",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := buildCityBasedSearchAddr(tt.addr, tt.chomeSearchAddr); got != tt.expected {
				t.Errorf("buildCityBasedSearchAddr() = %q, want %q", got, tt.expected)
			}
		})
	}
}

func TestConvertColonToChome(t *testing.T) {
	tests := []struct {
		name       string
		searchAddr string
		expected   string
	}{
		// no colon
		{"no colon", "港区虎ノ門", "港区虎ノ門"},
		// empty after colon (trailing colon is dropped by parsedAddress.String())
		{"empty after colon", "港区虎ノ門:", "港区虎ノ門"},
		// already has @
		{"already has @", "入舟3@:4-1", "入舟3@:4-1"},
		// alphabet after colon - skip conversion
		{"alphabet after colon", "町:A-20", "町:A-20"},
		// katakana after colon - skip conversion
		{"katakana after colon", "町:エ-46", "町:エ-46"},
		// lowercase alphabet after colon - skip conversion (#361)
		{"lowercase alphabet after colon", "町:a-20", "町:a-20"},
		// normal conversion with hyphen
		{"normal with hyphen", "浦安市舞浜:2-11", "浦安市舞浜2@:11"},
		// normal conversion without hyphen
		{"no hyphen", "浦安市舞浜:2", "浦安市舞浜2@"},
		// complex case
		{"complex", "港区虎ノ門:1-23-1", "港区虎ノ門1@:23-1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := convertColonToChome(parseSearchAddr(tt.searchAddr)).String(); got != tt.expected {
				t.Errorf("convertColonToChome(%q) = %q, want %q", tt.searchAddr, got, tt.expected)
			}
		})
	}
}

func TestIsSenGoPattern(t *testing.T) {
	tests := []struct {
		name     string
		addr     string
		expected bool
	}{
		// valid sen-go patterns
		{"valid sen-go", "7線:1号", true},
		{"valid sen-go with hyphen", "7線:1号-2", true},
		// invalid patterns
		{"no colon", "7線1号", false},
		{"empty after colon", "7線:", false},
		{"not ending with 線", "7丁目:1号", false},
		{"not ending with 号", "7線:1丁目", false},
		{"empty string", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := transform.IsSenGoPattern(tt.addr); got != tt.expected {
				t.Errorf("IsSenGoPattern(%q) = %v, want %v", tt.addr, got, tt.expected)
			}
		})
	}
}

func TestBuildParcelSearchAddr(t *testing.T) {
	tests := []struct {
		name       string
		sa         *model.StructuredAddress
		afterColon string
		expected   string
	}{
		// Note: nil sa causes panic, so we don't test it
		// The function expects non-nil StructuredAddress
		{
			name:       "empty structured address",
			sa:         &model.StructuredAddress{},
			afterColon: "123",
			expected:   ":123",
		},
		{
			name: "city only",
			sa: &model.StructuredAddress{
				City: new("下田市"),
			},
			afterColon: "123",
			expected:   "下田市:123",
		},
		{
			name: "city with ward",
			sa: &model.StructuredAddress{
				City: new("横浜市"),
				Ward: new("中区"),
			},
			afterColon: "1-2",
			expected:   "横浜市中区:1-2",
		},
		{
			name: "full address",
			sa: &model.StructuredAddress{
				City:    new("千代田区"),
				OazaCho: new("霞が関"),
				Chome:   new("1丁目"),
			},
			afterColon: "1-1",
			expected:   "千代田区霞が関1丁目:1-1",
		},
		{
			name: "with koaza",
			sa: &model.StructuredAddress{
				City:    new("七尾市"),
				OazaCho: new("柑子町"),
				Koaza:   new("チ"),
			},
			afterColon: "100",
			expected:   "七尾市柑子町チ:100",
		},
		{
			name: "empty afterColon",
			sa: &model.StructuredAddress{
				City: new("渋谷区"),
			},
			afterColon: "",
			expected:   "渋谷区",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := buildSearchAddrWithoutKyotoSt(tt.sa, tt.afterColon); got != tt.expected {
				t.Errorf("buildSearchAddrWithoutKyotoSt() = %q, want %q", got, tt.expected)
			}
		})
	}
}

func BenchmarkNormalize(b *testing.B) {
	c, err := cache.NewDuckDBCache(b.Context())
	if err != nil {
		b.Skipf("Failed to create cache: %v", err)
	}
	cfg, err := cache.LoadConfig(b.Context(), c.DB())
	if err != nil {
		b.Fatalf("load cache config: %v", err)
	}
	normalizer := NewMatcher(repository.NewRepository(c.DB()), c.Lookups(), cfg.HasResidential(), cfg.HasParcel())

	queries := []model.MatchQuery{
		{
			Address:  "東京都千代田区霞が関1-1-1",
			Category: model.CategoryBasic,
			Pref:     "all",
			Limit:    1,
		},
		{
			Address:  "東京都中央区勝どき五丁目12番4号",
			Category: model.CategoryResidential,
			Pref:     "all",
			Limit:    1,
		},
		{
			Address:  "岡山県新見市神郷下神代2029番地",
			Category: model.CategoryParcel,
			Pref:     "all",
			Limit:    1,
		},
		{
			Address:  "東京都千代田区霞が関1-2-3",
			Category: model.CategoryAll,
			Pref:     "all",
			Limit:    1,
		},
	}

	b.ResetTimer()
	ctx := b.Context()
	for range b.N {
		for _, query := range queries {
			_, _ = normalizer.Match(ctx, query)
		}
	}
}

func TestNormalizeByCategoryUnknownCategory(t *testing.T) {
	n := &Impl{}
	_, err := n.normalizeByCategory(context.Background(), &normalizeContext{}, model.Category("bogus"))
	if !errors.Is(err, ErrUnknownCategory) {
		t.Errorf("normalizeByCategory(bogus) error = %v, want it to match ErrUnknownCategory", err)
	}
}
