package command

import (
	"context"
	"errors"
	"testing"

	"abrdb/internal/model"
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

// TestChangesPendingError pins the properties main relies on for the exit
// code contract: it is an error whose dedicated exit code is 1.
func TestChangesPendingError(t *testing.T) {
	err := ChangesPendingError{Message: "changes pending"}

	if got := err.Error(); got != "changes pending" {
		t.Errorf("Error() = %q, want %q", got, "changes pending")
	}
	if got := err.ExitCode(); got != 1 {
		t.Errorf("ExitCode() = %d, want 1", got)
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
