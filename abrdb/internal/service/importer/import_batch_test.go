package importer

import (
	"context"
	"errors"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"sync"
	"testing"

	"abrdb/internal/model"
	"abrdb/internal/schema"
)

// --- fakes ---

type loadCall struct {
	textPath string
	posPath  string
}

type fakeLoader struct {
	mu     sync.Mutex
	calls  []loadCall
	errFor map[string]error // keyed by textPath
}

func (f *fakeLoader) LoadData(_ context.Context, _ *schema.CategoryInfo, textPath, posPath string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, loadCall{textPath, posPath})
	return f.errFor[textPath]
}

func (f *fakeLoader) textPaths() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]string, len(f.calls))
	for i, c := range f.calls {
		out[i] = c.textPath
	}
	sort.Strings(out)
	return out
}

type fakeStore struct {
	mu      sync.Mutex
	pending map[model.FileCategory][]*model.File
	pendErr error
	marked  [][]string
}

func (f *fakeStore) PendingImportsByCategory(_ context.Context, _ []model.FileCategory) (map[model.FileCategory][]*model.File, error) {
	if f.pendErr != nil {
		return nil, f.pendErr
	}
	return f.pending, nil
}

func (f *fakeStore) MarkAsImported(_ context.Context, filenames ...string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.marked = append(f.marked, slices.Clone(filenames))
	return nil
}

func (f *fakeStore) markedContains(want ...string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, got := range f.marked {
		if slices.Equal(got, want) {
			return true
		}
	}
	return false
}

type noopMonitor struct{}

func (noopMonitor) StartTask(string, int64) {}
func (noopMonitor) UpdateProgress(int64)    {}
func (noopMonitor) CompleteTask()           {}
func (noopMonitor) Cancel()                 {}

func textFile(cat model.FileCategory, key, filename string) *model.File {
	return &model.File{FileCategory: cat, FileKey: key, Filename: filename, FileType: model.FileTypeText}
}

func posFile(cat model.FileCategory, key, filename string) *model.File {
	return &model.File{FileCategory: cat, FileKey: key, Filename: filename, FileType: model.FileTypePos}
}

const downloadDir = "/dl"

func newService(loader loader, store catalogStore, cats ...model.FileCategory) *service {
	infoMap := make(map[string]*schema.CategoryInfo, len(cats))
	for _, c := range cats {
		infoMap[string(c)] = &schema.CategoryInfo{}
	}
	return New(loader, store, noopMonitor{}, downloadDir, infoMap)
}

// --- tests ---

func TestImportCategoryBatch_LoadsPairsAndMarksImported(t *testing.T) {
	loader := &fakeLoader{}
	store := &fakeStore{pending: map[model.FileCategory][]*model.File{
		model.CategoryPref: {
			textFile(model.CategoryPref, "pref/13", "pref_text.zip"),
			posFile(model.CategoryPref, "pref/13", "pref_pos.zip"),
		},
		model.CategoryCity: {
			textFile(model.CategoryCity, "city/13", "city_text.zip"), // text-only pair
		},
	}}

	svc := newService(loader, store, model.CategoryPref, model.CategoryCity)
	times, err := svc.ImportCategoryBatch(context.Background(), []model.FileCategory{model.CategoryPref, model.CategoryCity})
	if err != nil {
		t.Fatalf("ImportCategoryBatch: %v", err)
	}

	// Both categories ran, each timed.
	if _, ok := times[string(model.CategoryPref)]; !ok {
		t.Error("missing timing for pref")
	}
	if _, ok := times[string(model.CategoryCity)]; !ok {
		t.Error("missing timing for city")
	}

	// LoadData called for each pair with download-dir-joined paths.
	wantText := []string{filepath.Join(downloadDir, "city_text.zip"), filepath.Join(downloadDir, "pref_text.zip")}
	if got := loader.textPaths(); !slices.Equal(got, wantText) {
		t.Errorf("loaded text paths = %v, want %v", got, wantText)
	}

	// The text+pos pair carries a joined pos path; the text-only pair does not.
	loader.mu.Lock()
	var prefPos, cityPos string
	for _, c := range loader.calls {
		switch c.textPath {
		case filepath.Join(downloadDir, "pref_text.zip"):
			prefPos = c.posPath
		case filepath.Join(downloadDir, "city_text.zip"):
			cityPos = c.posPath
		}
	}
	loader.mu.Unlock()
	if prefPos != filepath.Join(downloadDir, "pref_pos.zip") {
		t.Errorf("pref pos path = %q, want joined pos file", prefPos)
	}
	if cityPos != "" {
		t.Errorf("city pos path = %q, want empty (text-only)", cityPos)
	}

	// MarkAsImported records both filenames for the pair, only text for text-only.
	if !store.markedContains("pref_text.zip", "pref_pos.zip") {
		t.Errorf("pref pair not marked with both files: %v", store.marked)
	}
	if !store.markedContains("city_text.zip") {
		t.Errorf("city text not marked: %v", store.marked)
	}
}

func TestImportCategoryBatch_SkipsCategoryWithNoPending(t *testing.T) {
	loader := &fakeLoader{}
	store := &fakeStore{pending: map[model.FileCategory][]*model.File{
		model.CategoryPref: {textFile(model.CategoryPref, "pref/13", "pref_text.zip")},
		model.CategoryCity: {}, // empty
	}}

	svc := newService(loader, store, model.CategoryPref, model.CategoryCity)
	times, err := svc.ImportCategoryBatch(context.Background(), []model.FileCategory{model.CategoryPref, model.CategoryCity})
	if err != nil {
		t.Fatalf("ImportCategoryBatch: %v", err)
	}
	if _, ok := times[string(model.CategoryCity)]; ok {
		t.Error("city has no pending files and must not be timed")
	}
	if len(loader.calls) != 1 {
		t.Errorf("LoadData calls = %d, want 1", len(loader.calls))
	}
}

func TestImportCategoryBatch_MissingCategoryInfoErrors(t *testing.T) {
	loader := &fakeLoader{}
	store := &fakeStore{pending: map[model.FileCategory][]*model.File{
		model.CategoryPref: {textFile(model.CategoryPref, "pref/13", "pref_text.zip")},
	}}

	// Service built WITHOUT registering CategoryPref's info.
	svc := New(loader, store, noopMonitor{}, downloadDir, map[string]*schema.CategoryInfo{})
	_, err := svc.ImportCategoryBatch(context.Background(), []model.FileCategory{model.CategoryPref})
	if err == nil || !errContains(err, "no category info") {
		t.Fatalf("err = %v, want 'no category info'", err)
	}
	if len(loader.calls) != 0 {
		t.Error("LoadData must not run when category info is missing")
	}
}

func TestImportCategoryBatch_PendingQueryErrorPropagates(t *testing.T) {
	store := &fakeStore{pendErr: errors.New("db down")}
	svc := newService(&fakeLoader{}, store, model.CategoryPref)
	_, err := svc.ImportCategoryBatch(context.Background(), []model.FileCategory{model.CategoryPref})
	if err == nil || !errContains(err, "get pending imports") {
		t.Fatalf("err = %v, want 'get pending imports'", err)
	}
}

func TestImportCategoryBatch_LoadErrorPropagatesAndSkipsMark(t *testing.T) {
	failing := filepath.Join(downloadDir, "pref_text.zip")
	loader := &fakeLoader{errFor: map[string]error{failing: errors.New("etl boom")}}
	store := &fakeStore{pending: map[model.FileCategory][]*model.File{
		model.CategoryPref: {textFile(model.CategoryPref, "pref/13", "pref_text.zip")},
	}}

	svc := newService(loader, store, model.CategoryPref)
	_, err := svc.ImportCategoryBatch(context.Background(), []model.FileCategory{model.CategoryPref})
	if err == nil || !errContains(err, "import files for") {
		t.Fatalf("err = %v, want 'import files for'", err)
	}
	if store.markedContains("pref_text.zip") {
		t.Error("a file whose load failed must not be marked imported")
	}
}

func errContains(err error, sub string) bool {
	return err != nil && strings.Contains(err.Error(), sub)
}
