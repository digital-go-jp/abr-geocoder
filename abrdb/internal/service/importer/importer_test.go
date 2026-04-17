package importer

import (
	"context"
	"testing"

	"abrdb/internal/model"
	"abrdb/internal/schema"
)

func TestNew(t *testing.T) {
	t.Run("basic", func(t *testing.T) {
		svc := New(nil, nil, nil, "/tmp/downloads", nil)

		if svc == nil {
			t.Fatal("New() returned nil")
		}
		if svc.downloadDir != "/tmp/downloads" {
			t.Errorf("downloadDir = %q, want %q", svc.downloadDir, "/tmp/downloads")
		}
	})

	t.Run("all fields", func(t *testing.T) {
		categoryMap := map[string]*schema.CategoryInfo{
			"test": {},
		}
		svc := New(nil, nil, nil, "/data/downloads", categoryMap)

		if svc.etlService != nil {
			t.Error("etlService should be nil")
		}
		if svc.executor != nil {
			t.Error("executor should be nil")
		}
		if svc.progress != nil {
			t.Error("progress should be nil")
		}
		if svc.downloadDir != "/data/downloads" {
			t.Errorf("downloadDir = %q, want %q", svc.downloadDir, "/data/downloads")
		}
		if svc.categoryInfoMap == nil {
			t.Error("categoryInfoMap should not be nil")
		}
	})
}

func TestImportCategoryBatch_EmptySlice(t *testing.T) {
	svc := New(nil, nil, nil, "/tmp", nil)
	phaseSec, err := svc.ImportCategoryBatch(context.Background(), []model.FileCategory{})
	if err != nil {
		t.Errorf("expected nil error for empty category, got %v", err)
	}
	if phaseSec == nil {
		t.Error("expected non-nil phaseSec map for empty category")
	}
	if len(phaseSec) != 0 {
		t.Errorf("expected empty phaseSec map, got %v", phaseSec)
	}
}
