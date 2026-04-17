package catalog

import (
	"testing"

	"abrdb/internal/infra/api"
	"abrdb/internal/model"
	"abrdb/internal/schema"
)

func TestExtractCategoryFromPrefix(t *testing.T) {
	// Create categoryInfoMap for testing
	categoryInfoMap := map[string]*schema.CategoryInfo{
		"mt_pref": {
			S3TextPath: "mt_pref/",
			S3PosPath:  "mt_pref_pos/",
		},
		"mt_city": {
			S3TextPath: "mt_city/pref/",
			S3PosPath:  "mt_city_pos/pref/",
		},
		"mt_town": {
			S3TextPath: "mt_town_fullset/pref/",
			S3PosPath:  "mt_town_pos/pref/",
		},
		"mt_rsdtdsp_blk": {
			S3TextPath: "mt_rsdtdsp_blk/pref/",
			S3PosPath:  "mt_rsdtdsp_blk_pos/pref/",
		},
		"mt_rsdtdsp_rsdt": {
			S3TextPath: "mt_rsdtdsp_rsdt/pref/",
			S3PosPath:  "mt_rsdtdsp_rsdt_pos/pref/",
		},
		"mt_parcel": {
			S3TextPath: "mt_parcel/city/",
			S3PosPath:  "mt_parcel_pos/city/",
		},
	}

	s := &service{categoryInfoMap: categoryInfoMap}

	tests := []struct {
		name   string
		prefix string
		want   model.FileCategory
	}{
		{
			name:   "mt_pref text prefix",
			prefix: "mt_pref/",
			want:   model.CategoryPref,
		},
		{
			name:   "mt_pref_pos pos prefix",
			prefix: "mt_pref_pos/",
			want:   model.CategoryPref,
		},
		{
			name:   "mt_city text prefix",
			prefix: "mt_city/pref/",
			want:   model.CategoryCity,
		},
		{
			name:   "mt_city_pos pos prefix",
			prefix: "mt_city_pos/pref/",
			want:   model.CategoryCity,
		},
		{
			name:   "mt_town text prefix",
			prefix: "mt_town_fullset/pref/",
			want:   model.CategoryTown,
		},
		{
			name:   "mt_town_pos pos prefix",
			prefix: "mt_town_pos/pref/",
			want:   model.CategoryTown,
		},
		{
			name:   "mt_rsdtdsp_blk text prefix",
			prefix: "mt_rsdtdsp_blk/pref/",
			want:   model.CategoryRsdtdspBlk,
		},
		{
			name:   "mt_rsdtdsp_blk_pos pos prefix",
			prefix: "mt_rsdtdsp_blk_pos/pref/",
			want:   model.CategoryRsdtdspBlk,
		},
		{
			name:   "mt_rsdtdsp_rsdt text prefix",
			prefix: "mt_rsdtdsp_rsdt/pref/",
			want:   model.CategoryRsdtdspRsdt,
		},
		{
			name:   "mt_rsdtdsp_rsdt_pos pos prefix",
			prefix: "mt_rsdtdsp_rsdt_pos/pref/",
			want:   model.CategoryRsdtdspRsdt,
		},
		{
			name:   "mt_parcel text prefix",
			prefix: "mt_parcel/city/",
			want:   model.CategoryParcel,
		},
		{
			name:   "mt_parcel_pos pos prefix",
			prefix: "mt_parcel_pos/city/",
			want:   model.CategoryParcel,
		},
		{
			name:   "unknown prefix",
			prefix: "unknown/path/",
			want:   model.FileCategory(""),
		},
		{
			name:   "empty prefix",
			prefix: "",
			want:   model.FileCategory(""),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := s.extractCategoryFromPrefix(tt.prefix)
			if got != tt.want {
				t.Errorf("extractCategoryFromPrefix() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestService_IsProcessable(t *testing.T) {
	tests := []struct {
		name            string
		enabledPref     []int
		enabledCategory map[model.FileCategory]bool
		enabledPos      bool
		fileInfo        *model.File
		want            bool
	}{
		{
			name:            "no filters - all files allowed",
			enabledPref:     []int{},
			enabledCategory: map[model.FileCategory]bool{},
			enabledPos:      true,
			fileInfo: &model.File{
				FileCategory: model.CategoryPref,
				PrefCode:     13,
				FileType:     model.FileTypeText,
			},
			want: true,
		},
		{
			name:            "category filter - matching category",
			enabledPref:     []int{},
			enabledCategory: map[model.FileCategory]bool{model.CategoryPref: true},
			enabledPos:      true,
			fileInfo: &model.File{
				FileCategory: model.CategoryPref,
				PrefCode:     13,
				FileType:     model.FileTypeText,
			},
			want: true,
		},
		{
			name:            "category filter - non-matching category",
			enabledPref:     []int{},
			enabledCategory: map[model.FileCategory]bool{model.CategoryCity: true},
			enabledPos:      true,
			fileInfo: &model.File{
				FileCategory: model.CategoryPref,
				PrefCode:     13,
				FileType:     model.FileTypeText,
			},
			want: false,
		},
		{
			name:            "prefecture filter - matching prefecture",
			enabledPref:     model.AllPrefectureCodes(),
			enabledCategory: map[model.FileCategory]bool{},
			enabledPos:      true,
			fileInfo: &model.File{
				FileCategory: model.CategoryCity,
				PrefCode:     13,
				FileType:     model.FileTypeText,
			},
			want: true,
		},
		{
			name:            "prefecture filter - non-matching prefecture",
			enabledPref:     []int{27},
			enabledCategory: map[model.FileCategory]bool{},
			enabledPos:      true,
			fileInfo: &model.File{
				FileCategory: model.CategoryCity,
				PrefCode:     1,
				FileType:     model.FileTypeText,
			},
			want: false,
		},
		{
			name:            "prefecture filter - all file (prefCode=0)",
			enabledPref:     model.AllPrefectureCodes(),
			enabledCategory: map[model.FileCategory]bool{},
			enabledPos:      true,
			fileInfo: &model.File{
				FileCategory: model.CategoryPref,
				PrefCode:     0,
				FileType:     model.FileTypeText,
			},
			want: true,
		},
		{
			name:            "pos disabled - text file",
			enabledPref:     []int{},
			enabledCategory: map[model.FileCategory]bool{},
			enabledPos:      false,
			fileInfo: &model.File{
				FileCategory: model.CategoryCity,
				PrefCode:     13,
				FileType:     model.FileTypeText,
			},
			want: true,
		},
		{
			name:            "pos disabled - pos file",
			enabledPref:     []int{},
			enabledCategory: map[model.FileCategory]bool{},
			enabledPos:      false,
			fileInfo: &model.File{
				FileCategory: model.CategoryCity,
				PrefCode:     13,
				FileType:     model.FileTypePos,
			},
			want: false,
		},
		{
			name:            "pos enabled - pos file",
			enabledPref:     []int{},
			enabledCategory: map[model.FileCategory]bool{},
			enabledPos:      true,
			fileInfo: &model.File{
				FileCategory: model.CategoryCity,
				PrefCode:     13,
				FileType:     model.FileTypePos,
			},
			want: true,
		},
		{
			name:            "combined filters - all matching",
			enabledPref:     []int{13},
			enabledCategory: map[model.FileCategory]bool{model.CategoryCity: true},
			enabledPos:      true,
			fileInfo: &model.File{
				FileCategory: model.CategoryCity,
				PrefCode:     13,
				FileType:     model.FileTypeText,
			},
			want: true,
		},
		{
			name:            "combined filters - category mismatch",
			enabledPref:     []int{13},
			enabledCategory: map[model.FileCategory]bool{model.CategoryTown: true},
			enabledPos:      true,
			fileInfo: &model.File{
				FileCategory: model.CategoryCity,
				PrefCode:     13,
				FileType:     model.FileTypeText,
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &service{
				enabledPref:     tt.enabledPref,
				enabledCategory: tt.enabledCategory,
				enabledPos:      tt.enabledPos,
			}

			got := s.isProcessable(tt.fileInfo)
			if got != tt.want {
				t.Errorf("isProcessable() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestNew(t *testing.T) {
	cfg := ServiceConfig{
		APIClient:   api.New("https://example.com/feed.json"),
		Executor:    nil,
		DownloadDir: "/tmp/downloads",
		EnabledPref: []int{1},
		EnabledCategory: map[model.FileCategory]bool{
			model.CategoryPref: true,
		},
		EnabledPos: true,
	}

	svc := New(cfg)

	if svc == nil {
		t.Fatal("New() returned nil")
	}

	if svc.apiClient != cfg.APIClient {
		t.Errorf("apiClient not set correctly")
	}

	if svc.downloadDir != cfg.DownloadDir {
		t.Errorf("downloadDir = %v, want %v", svc.downloadDir, cfg.DownloadDir)
	}

	if len(svc.enabledPref) != len(cfg.EnabledPref) {
		t.Errorf("enabledPref length = %v, want %v", len(svc.enabledPref), len(cfg.EnabledPref))
	}

	if len(svc.enabledCategory) != len(cfg.EnabledCategory) {
		t.Errorf("enabledCategory length = %v, want %v", len(svc.enabledCategory), len(cfg.EnabledCategory))
	}

	if svc.enabledPos != cfg.EnabledPos {
		t.Errorf("enabledPos = %v, want %v", svc.enabledPos, cfg.EnabledPos)
	}
}
