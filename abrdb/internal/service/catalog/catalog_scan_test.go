package catalog

import (
	"context"
	"testing"
	"time"

	"abrdb/internal/infra/api"
	"abrdb/internal/model"
	"abrdb/internal/schema"
)

// fakeLister serves fixed FileInfo lists per prefix.
type fakeLister struct {
	files map[string][]api.FileInfo
}

func (f *fakeLister) ListFilesByPrefix(_ context.Context, prefix string) ([]api.FileInfo, error) {
	return f.files[prefix], nil
}

// fakeStore records catalog writes in memory.
type fakeStore struct {
	existing map[model.FileCategory]map[string]*model.File
	upserted []*model.File
	synced   bool
}

func (f *fakeStore) FilesByCategory(_ context.Context, category model.FileCategory) (map[string]*model.File, error) {
	if m := f.existing[category]; m != nil {
		return m, nil
	}
	return map[string]*model.File{}, nil
}

func (f *fakeStore) UpsertFile(_ context.Context, record *model.File) error {
	f.upserted = append(f.upserted, record)
	return nil
}

func (f *fakeStore) SyncPairImportStatus(context.Context) error {
	f.synced = true
	return nil
}

func newScanTestService(t *testing.T, lister *fakeLister, store *fakeStore) *service {
	t.Helper()
	return &service{ServiceConfig{
		APIClient:   lister,
		Store:       store,
		DownloadDir: t.TempDir(),
		CategoryInfoMap: map[string]*schema.CategoryInfo{
			"town": {S3TextPath: "mt_town/", S3PosPath: "mt_town_pos/"},
		},
	}}
}

func TestScanAndCompare_ReportsNewFiles(t *testing.T) {
	modified := time.Date(2026, 5, 28, 9, 0, 0, 0, time.UTC)
	lister := &fakeLister{files: map[string][]api.FileInfo{
		"mt_town/": {{
			URL:          "https://example.com/mt_town/mt_town_all.csv.zip",
			Filename:     "mt_town_all.csv.zip",
			LastModified: modified,
		}},
	}}
	store := &fakeStore{}
	svc := newScanTestService(t, lister, store)

	result, err := svc.ScanAndCompare(t.Context(), []string{"mt_town/"})
	if err != nil {
		t.Fatalf("ScanAndCompare() error = %v", err)
	}
	if len(result.UpdatedFiles) != 1 {
		t.Fatalf("UpdatedFiles = %d, want 1", len(result.UpdatedFiles))
	}
	if len(store.upserted) != 0 {
		t.Errorf("dry-run upserted %d records, want 0", len(store.upserted))
	}
}

func TestScanAndCompare_SkipsUnchangedFiles(t *testing.T) {
	modified := time.Date(2026, 5, 28, 9, 0, 0, 0, time.UTC)
	url := "https://example.com/mt_town/mt_town_all.csv.zip"
	lister := &fakeLister{files: map[string][]api.FileInfo{
		"mt_town/": {{URL: url, Filename: "mt_town_all.csv.zip", LastModified: modified}},
	}}
	store := &fakeStore{existing: map[model.FileCategory]map[string]*model.File{
		"town": {url: {SourceURL: url, LastModified: modified}},
	}}
	svc := newScanTestService(t, lister, store)

	result, err := svc.ScanAndCompare(t.Context(), []string{"mt_town/"})
	if err != nil {
		t.Fatalf("ScanAndCompare() error = %v", err)
	}
	if len(result.UpdatedFiles) != 0 {
		t.Errorf("UpdatedFiles = %d, want 0", len(result.UpdatedFiles))
	}
}

func TestScanAndUpdate_UpsertsAndSyncsPairs(t *testing.T) {
	modified := time.Date(2026, 5, 28, 9, 0, 0, 0, time.UTC)
	lister := &fakeLister{files: map[string][]api.FileInfo{
		"mt_town/": {{
			URL:          "https://example.com/mt_town/mt_town_all.csv.zip",
			Filename:     "mt_town_all.csv.zip",
			LastModified: modified,
		}},
	}}
	store := &fakeStore{}
	svc := newScanTestService(t, lister, store)

	result, err := svc.ScanAndUpdate(t.Context(), []string{"mt_town/"}, false)
	if err != nil {
		t.Fatalf("ScanAndUpdate() error = %v", err)
	}
	if result.UpdatedCount != 1 {
		t.Errorf("UpdatedCount = %d, want 1", result.UpdatedCount)
	}
	if len(store.upserted) != 1 {
		t.Fatalf("upserted %d records, want 1", len(store.upserted))
	}
	if got := store.upserted[0]; !got.NeedsDownload || !got.NeedsImport {
		t.Errorf("upserted record flags = download:%v import:%v, want both true", got.NeedsDownload, got.NeedsImport)
	}
	if !store.synced {
		t.Error("SyncPairImportStatus was not called after updates")
	}
}

func TestScanAndUpdate_NoChangesSkipsPairSync(t *testing.T) {
	modified := time.Date(2026, 5, 28, 9, 0, 0, 0, time.UTC)
	url := "https://example.com/mt_town/mt_town_all.csv.zip"
	lister := &fakeLister{files: map[string][]api.FileInfo{
		"mt_town/": {{URL: url, Filename: "mt_town_all.csv.zip", LastModified: modified}},
	}}
	store := &fakeStore{existing: map[model.FileCategory]map[string]*model.File{
		"town": {url: {SourceURL: url, LastModified: modified}},
	}}
	svc := newScanTestService(t, lister, store)

	result, err := svc.ScanAndUpdate(t.Context(), []string{"mt_town/"}, false)
	if err != nil {
		t.Fatalf("ScanAndUpdate() error = %v", err)
	}
	if result.UpdatedCount != 0 {
		t.Errorf("UpdatedCount = %d, want 0", result.UpdatedCount)
	}
	if store.synced {
		t.Error("SyncPairImportStatus called with no updates")
	}
}
