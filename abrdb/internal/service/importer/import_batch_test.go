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
	mu             sync.Mutex
	pending        map[model.FileCategory][]*model.File
	pendErr        error
	marked         [][]string
	deleted        []string
	empty          bool
	indexed        []string
	analyzed       [][]string
	analyzeErr     error
	pendingAnalyze []string // persisted analyze backlog, mutated like the real store
	cleared        int
}

func (f *fakeStore) AnalyzeTables(_ context.Context, tableNames []string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.analyzed = append(f.analyzed, slices.Clone(tableNames))
	return f.analyzeErr
}

func (f *fakeStore) PendingAnalyzeTables(context.Context) ([]string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return slices.Clone(f.pendingAnalyze), nil
}

func (f *fakeStore) AddPendingAnalyzeTable(_ context.Context, tableName string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if !slices.Contains(f.pendingAnalyze, tableName) {
		f.pendingAnalyze = append(f.pendingAnalyze, tableName)
	}
	return nil
}

func (f *fakeStore) ClearPendingAnalyze(context.Context) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.pendingAnalyze = nil
	f.cleared++
	return nil
}

func (f *fakeStore) DeleteFileScope(_ context.Context, tableName, filename string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.deleted = append(f.deleted, tableName+":"+filename)
	return nil
}

func (f *fakeStore) TableIsEmpty(_ context.Context, _ string) (bool, error) {
	return f.empty, nil
}

func (f *fakeStore) EnsureLgCodeIndex(_ context.Context, tableName string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.indexed = append(f.indexed, tableName)
	return nil
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
	times, err := svc.ImportCategoryBatch(t.Context(), []model.FileCategory{model.CategoryPref, model.CategoryCity})
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

	// Each pair's prior rows are deleted, keyed by the text filename.
	store.mu.Lock()
	deleted := slices.Clone(store.deleted)
	store.mu.Unlock()
	sort.Strings(deleted)
	if want := []string{":city_text.zip", ":pref_text.zip"}; !slices.Equal(deleted, want) {
		t.Errorf("deleted scopes = %v, want %v", deleted, want)
	}

	// The lg_code index is ensured once per imported category.
	if len(store.indexed) != 2 {
		t.Errorf("EnsureLgCodeIndex calls = %v, want one per category", store.indexed)
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
	times, err := svc.ImportCategoryBatch(t.Context(), []model.FileCategory{model.CategoryPref, model.CategoryCity})
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
	_, err := svc.ImportCategoryBatch(t.Context(), []model.FileCategory{model.CategoryPref})
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
	_, err := svc.ImportCategoryBatch(t.Context(), []model.FileCategory{model.CategoryPref})
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
	_, err := svc.ImportCategoryBatch(t.Context(), []model.FileCategory{model.CategoryPref})
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

func TestImportCategoryBatch_SkipsDeleteWhenTableEmpty(t *testing.T) {
	loader := &fakeLoader{}
	store := &fakeStore{
		empty: true,
		pending: map[model.FileCategory][]*model.File{
			model.CategoryPref: {textFile(model.CategoryPref, "pref/13", "pref_text.zip")},
		},
	}

	svc := newService(loader, store, model.CategoryPref)
	if _, err := svc.ImportCategoryBatch(t.Context(), []model.FileCategory{model.CategoryPref}); err != nil {
		t.Fatalf("ImportCategoryBatch: %v", err)
	}

	// Initial build into an empty table: nothing to delete, but data still
	// loads and the index is created afterwards.
	if len(store.deleted) != 0 {
		t.Errorf("deleted scopes = %v, want none for empty table", store.deleted)
	}
	if len(loader.calls) != 1 {
		t.Errorf("LoadData calls = %d, want 1", len(loader.calls))
	}
	if len(store.indexed) != 1 {
		t.Errorf("EnsureLgCodeIndex calls = %v, want 1", store.indexed)
	}
}

// --- DB-24: post-import ANALYZE ---

// TestImportCategoryBatch_AnalyzesUpdatedTables pins the DB-24 contract:
// after every category imports successfully, exactly one ANALYZE pass runs
// over the deduplicated set of tables this run wrote, in category order.
func TestImportCategoryBatch_AnalyzesUpdatedTables(t *testing.T) {
	catA, catB, catC := model.FileCategory("a"), model.FileCategory("b"), model.FileCategory("c")
	store := &fakeStore{pending: map[model.FileCategory][]*model.File{
		catA: {textFile(catA, "a/1", "a1.zip")},
		catB: {textFile(catB, "b/1", "b1.zip")},
		catC: {textFile(catC, "c/1", "c1.zip")},
	}}
	infoMap := map[string]*schema.CategoryInfo{
		"a": {TableName: "mt_shared"},
		"b": {TableName: "mt_shared"}, // same table as a: must be analyzed once
		"c": {TableName: "mt_other"},
	}

	svc := New(&fakeLoader{}, store, noopMonitor{}, downloadDir, infoMap)
	if _, err := svc.ImportCategoryBatch(t.Context(), []model.FileCategory{catA, catB, catC}); err != nil {
		t.Fatalf("ImportCategoryBatch: %v", err)
	}

	want := [][]string{{"mt_shared", "mt_other"}}
	if len(store.analyzed) != 1 || !slices.Equal(store.analyzed[0], want[0]) {
		t.Errorf("AnalyzeTables calls = %v, want %v", store.analyzed, want)
	}
}

func TestImportCategoryBatch_NoPendingSkipsAnalyze(t *testing.T) {
	store := &fakeStore{pending: map[model.FileCategory][]*model.File{}}
	svc := newService(&fakeLoader{}, store, model.CategoryPref)

	if _, err := svc.ImportCategoryBatch(t.Context(), []model.FileCategory{model.CategoryPref}); err != nil {
		t.Fatalf("ImportCategoryBatch: %v", err)
	}
	if len(store.analyzed) != 0 {
		t.Errorf("AnalyzeTables calls = %v, want none", store.analyzed)
	}
}

// TestImportCategoryBatch_AnalyzeFailureFailsImport pins that an ANALYZE
// failure is an import failure (exit 2 at the CLI), not a warning: stale
// statistics would derail the subsequent cache build.
func TestImportCategoryBatch_AnalyzeFailureFailsImport(t *testing.T) {
	analyzeErr := errors.New("permission denied for table mt_pref_unified")
	store := &fakeStore{
		pending: map[model.FileCategory][]*model.File{
			model.CategoryPref: {textFile(model.CategoryPref, "pref/13", "pref_text.zip")},
		},
		analyzeErr: analyzeErr,
	}
	svc := newService(&fakeLoader{}, store, model.CategoryPref)

	_, err := svc.ImportCategoryBatch(t.Context(), []model.FileCategory{model.CategoryPref})
	if !errors.Is(err, analyzeErr) {
		t.Fatalf("err = %v, want wrapped %v", err, analyzeErr)
	}
}

// TestImportCategoryBatch_LoadFailureSkipsAnalyze: a failed category import
// aborts before any ANALYZE runs.
func TestImportCategoryBatch_LoadFailureSkipsAnalyze(t *testing.T) {
	failing := filepath.Join(downloadDir, "pref_text.zip")
	loader := &fakeLoader{errFor: map[string]error{failing: errors.New("etl boom")}}
	store := &fakeStore{pending: map[model.FileCategory][]*model.File{
		model.CategoryPref: {textFile(model.CategoryPref, "pref/13", "pref_text.zip")},
	}}

	svc := newService(loader, store, model.CategoryPref)
	if _, err := svc.ImportCategoryBatch(t.Context(), []model.FileCategory{model.CategoryPref}); err == nil {
		t.Fatal("err = nil, want load failure")
	}
	if len(store.analyzed) != 0 {
		t.Errorf("AnalyzeTables calls = %v, want none after a failed import", store.analyzed)
	}
}

// --- Codex review: analyze_pending persistence ---

// TestImportCategoryBatch_PersistsAnalyzeBacklog pins the recovery contract:
// each imported table is recorded in the persisted backlog before ANALYZE
// runs, and the backlog is cleared exactly once after a successful ANALYZE.
func TestImportCategoryBatch_PersistsAnalyzeBacklog(t *testing.T) {
	cat := model.FileCategory("a")
	store := &fakeStore{pending: map[model.FileCategory][]*model.File{
		cat: {textFile(cat, "a/1", "a1.zip")},
	}}
	svc := New(&fakeLoader{}, store, noopMonitor{}, downloadDir, map[string]*schema.CategoryInfo{
		"a": {TableName: "mt_shared"},
	})

	if _, err := svc.ImportCategoryBatch(t.Context(), []model.FileCategory{cat}); err != nil {
		t.Fatalf("ImportCategoryBatch: %v", err)
	}
	if len(store.pendingAnalyze) != 0 {
		t.Errorf("pendingAnalyze = %v, want cleared after successful ANALYZE", store.pendingAnalyze)
	}
	if store.cleared != 1 {
		t.Errorf("ClearPendingAnalyze calls = %d, want 1", store.cleared)
	}
	if len(store.analyzed) != 1 || !slices.Equal(store.analyzed[0], []string{"mt_shared"}) {
		t.Errorf("AnalyzeTables calls = %v, want [[mt_shared]]", store.analyzed)
	}
}

// TestImportCategoryBatch_AnalyzeFailureKeepsBacklog: when ANALYZE fails the
// import fails and the persisted backlog survives for the next run.
func TestImportCategoryBatch_AnalyzeFailureKeepsBacklog(t *testing.T) {
	analyzeErr := errors.New("analyze boom")
	cat := model.FileCategory("a")
	store := &fakeStore{
		pending:    map[model.FileCategory][]*model.File{cat: {textFile(cat, "a/1", "a1.zip")}},
		analyzeErr: analyzeErr,
	}
	svc := New(&fakeLoader{}, store, noopMonitor{}, downloadDir, map[string]*schema.CategoryInfo{
		"a": {TableName: "mt_shared"},
	})

	if _, err := svc.ImportCategoryBatch(t.Context(), []model.FileCategory{cat}); !errors.Is(err, analyzeErr) {
		t.Fatalf("err = %v, want wrapped %v", err, analyzeErr)
	}
	if !slices.Equal(store.pendingAnalyze, []string{"mt_shared"}) {
		t.Errorf("pendingAnalyze = %v, want [mt_shared] kept for the next run", store.pendingAnalyze)
	}
	if store.cleared != 0 {
		t.Errorf("ClearPendingAnalyze calls = %d, want 0 after a failed ANALYZE", store.cleared)
	}
}

// TestImportCategoryBatch_AnalyzeOnlyRun: no pending files but a persisted
// backlog from an earlier failed run - ANALYZE runs alone and clears it.
func TestImportCategoryBatch_AnalyzeOnlyRun(t *testing.T) {
	loader := &fakeLoader{}
	store := &fakeStore{
		pending:        map[model.FileCategory][]*model.File{},
		pendingAnalyze: []string{"mt_town_unified", "mt_parcel_unified"},
	}
	svc := newService(loader, store, model.CategoryTown)

	if _, err := svc.ImportCategoryBatch(t.Context(), []model.FileCategory{model.CategoryTown}); err != nil {
		t.Fatalf("ImportCategoryBatch: %v", err)
	}
	if len(loader.calls) != 0 {
		t.Errorf("LoadData calls = %d, want 0 in an analyze-only run", len(loader.calls))
	}
	want := [][]string{{"mt_town_unified", "mt_parcel_unified"}}
	if len(store.analyzed) != 1 || !slices.Equal(store.analyzed[0], want[0]) {
		t.Errorf("AnalyzeTables calls = %v, want %v", store.analyzed, want)
	}
	if store.cleared != 1 || len(store.pendingAnalyze) != 0 {
		t.Errorf("backlog not cleared: cleared=%d pendingAnalyze=%v", store.cleared, store.pendingAnalyze)
	}
}

// TestImportCategoryBatch_MergesBacklogWithCurrentRun: the ANALYZE target is
// this run's tables plus the persisted backlog, deduplicated.
func TestImportCategoryBatch_MergesBacklogWithCurrentRun(t *testing.T) {
	cat := model.FileCategory("a")
	store := &fakeStore{
		pending:        map[model.FileCategory][]*model.File{cat: {textFile(cat, "a/1", "a1.zip")}},
		pendingAnalyze: []string{"mt_leftover", "mt_shared"}, // mt_shared also updated this run
	}
	svc := New(&fakeLoader{}, store, noopMonitor{}, downloadDir, map[string]*schema.CategoryInfo{
		"a": {TableName: "mt_shared"},
	})

	if _, err := svc.ImportCategoryBatch(t.Context(), []model.FileCategory{cat}); err != nil {
		t.Fatalf("ImportCategoryBatch: %v", err)
	}
	want := []string{"mt_shared", "mt_leftover"}
	if len(store.analyzed) != 1 || !slices.Equal(store.analyzed[0], want) {
		t.Errorf("AnalyzeTables calls = %v, want [%v]", store.analyzed, want)
	}
}

// TestImportCategoryBatch_OrphanPosOnlyIsNotAnUpdate: a pending pos file
// without its text counterpart (known ABR feed state) forms no importable
// pair - the table is neither written nor analyzed.
func TestImportCategoryBatch_OrphanPosOnlyIsNotAnUpdate(t *testing.T) {
	cat := model.FileCategory("a")
	loader := &fakeLoader{}
	store := &fakeStore{pending: map[model.FileCategory][]*model.File{
		cat: {posFile(cat, "a/221023", "orphan_pos.zip")},
	}}
	svc := New(loader, store, noopMonitor{}, downloadDir, map[string]*schema.CategoryInfo{
		"a": {TableName: "mt_parcel_unified"},
	})

	times, err := svc.ImportCategoryBatch(t.Context(), []model.FileCategory{cat})
	if err != nil {
		t.Fatalf("ImportCategoryBatch: %v", err)
	}
	if len(loader.calls) != 0 || len(store.indexed) != 0 || len(times) != 0 {
		t.Errorf("orphan pos must not import: loads=%d indexed=%v times=%v", len(loader.calls), store.indexed, times)
	}
	if len(store.analyzed) != 0 || len(store.pendingAnalyze) != 0 {
		t.Errorf("orphan pos must not trigger ANALYZE: analyzed=%v pendingAnalyze=%v", store.analyzed, store.pendingAnalyze)
	}
}
