package command

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"testing"

	"abrdb/internal/config"
	"abrdb/internal/infra/postgres"
	"abrdb/internal/model"
	"abrdb/internal/schema"
	"abrdb/internal/service/catalog"
)

// fakeCatalog is a catalogAPI stub whose scan results are fixed per test case.
type fakeCatalog struct {
	scanResult   *catalog.ScanResult
	scanErr      error
	gotPrefixes  []string
	updateResult *catalog.UpdateResult
	updateErr    error
}

func (f *fakeCatalog) ScanAndCompare(_ context.Context, prefixes []string) (*catalog.ScanResult, error) {
	f.gotPrefixes = prefixes
	if f.scanErr != nil {
		return nil, f.scanErr
	}
	return f.scanResult, nil
}

func (f *fakeCatalog) ScanAndUpdate(_ context.Context, _ []string, _ bool) (*catalog.UpdateResult, error) {
	if f.updateErr != nil {
		return nil, f.updateErr
	}
	return f.updateResult, nil
}

// fakeSummaryStore is a pendingSummaryStore stub.
type fakeSummaryStore struct {
	summary        []postgres.PendingSummary
	err            error
	pendingAnalyze []string
	analyzeErr     error
	orphanPos      int
	orphanPosErr   error
}

func (f *fakeSummaryStore) GetPendingSummary(context.Context) ([]postgres.PendingSummary, error) {
	return f.summary, f.err
}

func (f *fakeSummaryStore) PendingAnalyzeTables(context.Context) ([]string, error) {
	return f.pendingAnalyze, f.analyzeErr
}

func (f *fakeSummaryStore) CountOrphanPosFiles(context.Context) (int, error) {
	return f.orphanPos, f.orphanPosErr
}

// TestRunImportDryRun_ExitCodes pins the dry-run exit code contract through
// runImportDryRun itself: nil (exit 0) when nothing is pending,
// ChangesPendingError (exit 1) when the scan or the catalog reports pending
// work, and a plain error (exit 2) when the summary query fails.
func TestRunImportDryRun_ExitCodes(t *testing.T) {
	summaryErr := errors.New("connection refused")

	tests := []struct {
		name      string
		store     *fakeSummaryStore
		scan      *catalog.ScanResult
		wantExit1 bool
		wantErr   error
	}{
		{
			name:  "no changes exits 0",
			store: &fakeSummaryStore{},
			scan:  &catalog.ScanResult{},
		},
		{
			name:      "scan updates exit 1",
			store:     &fakeSummaryStore{},
			scan:      &catalog.ScanResult{UpdatedFiles: []*model.File{{Filename: "a.csv.zip", FileCategory: model.FileCategory("town")}}},
			wantExit1: true,
		},
		{
			name:      "pending imports alone exit 1",
			store:     &fakeSummaryStore{summary: []postgres.PendingSummary{{Category: model.FileCategory("town"), ImportCount: 2}}},
			scan:      &catalog.ScanResult{},
			wantExit1: true,
		},
		{
			// A failed ANALYZE leaves files imported but statistics stale;
			// reporting it as exit 1 makes the daily workflow re-run the
			// import, which then performs the ANALYZE alone.
			name:      "pending analyze alone exits 1",
			store:     &fakeSummaryStore{pendingAnalyze: []string{"mt_town_unified"}},
			scan:      &catalog.ScanResult{},
			wantExit1: true,
		},
		{
			// Orphan pos files (no text counterpart in the feed) stay
			// needs_import forever. They are surfaced as a warning only and
			// must never flip the exit code, or the daily workflow would
			// report "changes pending" on every run.
			name:  "orphan pos files alone exit 0",
			store: &fakeSummaryStore{orphanPos: 1},
			scan:  &catalog.ScanResult{},
		},
		{
			// The warning is best-effort: a failed orphan count must not
			// break the dry-run contract.
			name:  "orphan pos count failure still exits 0",
			store: &fakeSummaryStore{orphanPosErr: summaryErr},
			scan:  &catalog.ScanResult{},
		},
		{
			name:    "summary failure exits 2",
			store:   &fakeSummaryStore{err: summaryErr},
			scan:    &catalog.ScanResult{},
			wantErr: summaryErr,
		},
		{
			name:    "pending analyze query failure exits 2",
			store:   &fakeSummaryStore{analyzeErr: summaryErr},
			scan:    &catalog.ScanResult{},
			wantErr: summaryErr,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeCatalog{scanResult: tt.scan}

			err := runImportDryRun(context.Background(), tt.store, fake, []string{"town/"}, &ImportOptions{DryRun: true})

			_, gotExit1 := errors.AsType[ChangesPendingError](err)
			if gotExit1 != tt.wantExit1 {
				t.Errorf("runImportDryRun() = %v, want ChangesPendingError=%v", err, tt.wantExit1)
			}
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Errorf("runImportDryRun() = %v, want wrapped %v", err, tt.wantErr)
				}
				if gotExit1 {
					t.Errorf("runImportDryRun() = %v, must not be ChangesPendingError", err)
				}
			}
			if tt.wantErr == nil && !tt.wantExit1 && err != nil {
				t.Errorf("runImportDryRun() = %v, want nil", err)
			}
		})
	}
}

// TestChangesPendingError pins the properties main relies on for the exit code
// contract: it carries its message, and it is still matched by type after
// wrapping, which is how main picks exit 1 (see TestExitCode in cmd/abrdb).
func TestChangesPendingError(t *testing.T) {
	err := ChangesPendingError{Message: "changes pending"}

	if got := err.Error(); got != "changes pending" {
		t.Errorf("Error() = %q, want %q", got, "changes pending")
	}

	var target ChangesPendingError
	if !errors.As(fmt.Errorf("dry-run: %w", err), &target) {
		t.Error("ChangesPendingError is not matched through a wrap; main would exit 2 instead of 1")
	}
}

// TestRunImportDryRun_ScanError verifies that a catalog scan failure
// propagates as a plain error, never as ChangesPendingError. Step Functions
// interprets exit 1 as "changes pending", so a failed check must map to
// exit 2, not 1.
func TestRunImportDryRun_ScanError(t *testing.T) {
	scanErr := errors.New("http 500")
	fake := &fakeCatalog{scanErr: scanErr}
	prefixes := []string{"town/", "town_pos/"}

	err := runImportDryRun(context.Background(), nil, fake, prefixes, &ImportOptions{DryRun: true})

	if err == nil {
		t.Fatal("runImportDryRun() = nil, want error")
	}
	if !errors.Is(err, scanErr) {
		t.Errorf("runImportDryRun() = %v, want wrapped %v", err, scanErr)
	}
	if _, ok := errors.AsType[ChangesPendingError](err); ok {
		t.Errorf("runImportDryRun() = %v, must not be ChangesPendingError", err)
	}
	if len(fake.gotPrefixes) != len(prefixes) {
		t.Errorf("ScanAndCompare got %d prefixes, want %d", len(fake.gotPrefixes), len(prefixes))
	}
}

// TestExecuteImportPipeline_ScanError verifies the same failure propagation
// for the non-dry-run pipeline entry point.
func TestExecuteImportPipeline_ScanError(t *testing.T) {
	scanErr := errors.New("catalog unavailable")
	fake := &fakeCatalog{updateErr: scanErr}

	err := executeImportPipeline(context.Background(), fake, nil, nil, []string{"town/"}, []model.FileCategory{model.CategoryTown}, false, false)

	if !errors.Is(err, scanErr) {
		t.Errorf("executeImportPipeline() = %v, want wrapped %v", err, scanErr)
	}
	if _, ok := errors.AsType[ChangesPendingError](err); ok {
		t.Errorf("executeImportPipeline() = %v, must not be ChangesPendingError", err)
	}
}

func TestReportDryRunSummary(t *testing.T) {
	tests := []struct {
		name           string
		pending        []postgres.PendingSummary
		updated        []*model.File
		pendingAnalyze []string
		wantExit1      bool
	}{
		{
			name: "no changes returns nil (exit 0)",
		},
		{
			name:      "updated files return ChangesPendingError (exit 1)",
			updated:   []*model.File{{Filename: "a.csv.zip", FileCategory: model.FileCategory("town")}},
			wantExit1: true,
		},
		{
			name:      "pending imports alone return ChangesPendingError (exit 1)",
			pending:   []postgres.PendingSummary{{Category: model.FileCategory("town"), ImportCount: 2}},
			wantExit1: true,
		},
		{
			name:           "pending analyze alone returns ChangesPendingError (exit 1)",
			pendingAnalyze: []string{"mt_town_unified", "mt_parcel_unified"},
			wantExit1:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := reportDryRunSummary(tt.pending, &catalog.ScanResult{UpdatedFiles: tt.updated}, tt.pendingAnalyze, false)
			var pendingErr ChangesPendingError
			gotExit1 := errors.As(err, &pendingErr)
			if gotExit1 != tt.wantExit1 {
				t.Errorf("reportDryRunSummary() = %v, want ChangesPendingError=%v", err, tt.wantExit1)
			}
			if err != nil && !gotExit1 {
				t.Errorf("reportDryRunSummary() unexpected error type: %v", err)
			}
		})
	}
}

func TestCollectCategory_SortedUnion(t *testing.T) {
	pending := map[model.FileCategory]int{"town": 1, "parcel": 2}
	updated := map[model.FileCategory][]*model.File{"city": nil, "town": nil}

	got := collectCategory(pending, updated)
	want := []model.FileCategory{"city", "parcel", "town"}
	if !slices.Equal(got, want) {
		t.Errorf("collectCategory() = %v, want %v", got, want)
	}
}

func TestBuildS3Prefixes(t *testing.T) {
	categoryInfoMap := map[string]*schema.CategoryInfo{
		"town":   {S3TextPath: "mt_town/", S3PosPath: "mt_town_pos/"},
		"parcel": {S3TextPath: "mt_parcel/", S3PosPath: "mt_parcel_pos/"},
	}

	tests := []struct {
		name    string
		cfg     config.ImportConfig
		want    []string
		wantErr bool
	}{
		{
			name: "text only",
			cfg:  config.ImportConfig{EnabledCategory: []model.FileCategory{"town"}},
			want: []string{"mt_town/"},
		},
		{
			name: "pos enabled adds pos path per category",
			cfg:  config.ImportConfig{EnabledCategory: []model.FileCategory{"town", "parcel"}, EnabledPos: true},
			want: []string{"mt_town/", "mt_town_pos/", "mt_parcel/", "mt_parcel_pos/"},
		},
		{
			name:    "unknown category errors",
			cfg:     config.ImportConfig{EnabledCategory: []model.FileCategory{"bogus"}},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := buildS3Prefixes(&tt.cfg, categoryInfoMap)
			if (err != nil) != tt.wantErr {
				t.Fatalf("buildS3Prefixes() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && !slices.Equal(got, tt.want) {
				t.Errorf("buildS3Prefixes() = %v, want %v", got, tt.want)
			}
		})
	}
}
