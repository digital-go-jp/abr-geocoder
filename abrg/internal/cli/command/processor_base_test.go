package command

import (
	"testing"

	"abrg/internal/cache"
	"abrg/internal/model"
)

func TestResolveQueryParams(t *testing.T) {
	tests := []struct {
		name            string
		opts            processorOptions
		enabledCategory string
		enabledPref     string
		wantCategory    model.Category
		wantPref        string
	}{
		{
			name:            "omitted flags fall back to the cache config",
			opts:            processorOptions{},
			enabledCategory: "all",
			enabledPref:     "all",
			wantCategory:    model.CategoryAll,
			wantPref:        "all",
		},
		{
			name:            "omitted pref falls back to a single prefecture",
			opts:            processorOptions{},
			enabledCategory: "all",
			enabledPref:     "13",
			wantCategory:    model.CategoryAll,
			wantPref:        "13",
		},
		{
			name:            "explicit flags are kept",
			opts:            processorOptions{Category: "basic", Pref: "13"},
			enabledCategory: "all",
			enabledPref:     "all",
			wantCategory:    model.CategoryBasic,
			wantPref:        "13",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &processorSetup{CacheCfg: &cache.Config{
				EnabledCategory: tt.enabledCategory,
				EnabledPref:     tt.enabledPref,
			}}
			s.resolveQueryParams(tt.opts)

			if s.Category != tt.wantCategory {
				t.Errorf("Category = %q, want %q", s.Category, tt.wantCategory)
			}
			if s.Pref != tt.wantPref {
				t.Errorf("Pref = %q, want %q", s.Pref, tt.wantPref)
			}
		})
	}
}
