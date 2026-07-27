package download

import (
	"os"
	"path/filepath"
	"sort"
	"testing"

	"abrdb/internal/model"
)

func TestNew(t *testing.T) {
	t.Run("basic", func(t *testing.T) {
		svc := New(nil, nil, nil, "/tmp/download")

		if svc == nil {
			t.Fatal("New() returned nil")
		}
		if svc.downloadDir != "/tmp/download" {
			t.Errorf("downloadDir = %q, want %q", svc.downloadDir, "/tmp/download")
		}
	})

	t.Run("all fields", func(t *testing.T) {
		svc := New(nil, nil, nil, "/data/downloads")

		if svc.apiClient != nil {
			t.Error("apiClient should be nil")
		}
		if svc.store != nil {
			t.Error("store should be nil")
		}
		if svc.progress != nil {
			t.Error("progress should be nil")
		}
		if svc.downloadDir != "/data/downloads" {
			t.Errorf("downloadDir = %q, want %q", svc.downloadDir, "/data/downloads")
		}
	})
}

// TestFilterMissingFiles covers the catalog/disk drift recovery used by
// DownloadPendingFiles. The original bug (https://...) failed when
// SyncPairImportStatus flagged a pair member as needs_import=true without also
// flagging needs_download=true; on ephemeral storage the file was absent and
// the import phase exploded.
func TestFilterMissingFiles(t *testing.T) {
	tmp := t.TempDir()

	// Pretend "text_a" was previously downloaded and persists on disk.
	write(t, filepath.Join(tmp, "text_a.csv.zip"))
	// "text_b" and "pos_b" are not on disk (drift).

	pending := []*model.File{
		{Filename: "text_a.csv.zip", SourceURL: "https://x/text_a.csv.zip"},
		{Filename: "text_b.csv.zip", SourceURL: "https://x/text_b.csv.zip"},
		{Filename: "pos_b.csv.zip", SourceURL: "https://x/pos_b.csv.zip"},
	}
	queued := []*model.File{
		// "text_b" already on the explicit download queue.
		{Filename: "text_b.csv.zip", SourceURL: "https://x/text_b.csv.zip"},
	}

	got := filterMissingFiles(pending, queued, tmp)

	names := make([]string, 0, len(got))
	for _, f := range got {
		names = append(names, f.Filename)
	}
	sort.Strings(names)

	want := []string{"pos_b.csv.zip"}
	if !equalStringSlices(names, want) {
		t.Errorf("filterMissingFiles() = %v, want %v", names, want)
	}
}

func TestFilterMissingFiles_AllPresent(t *testing.T) {
	tmp := t.TempDir()
	write(t, filepath.Join(tmp, "a.csv.zip"))
	write(t, filepath.Join(tmp, "b.csv.zip"))

	pending := []*model.File{
		{Filename: "a.csv.zip"},
		{Filename: "b.csv.zip"},
	}

	got := filterMissingFiles(pending, nil, tmp)

	if len(got) != 0 {
		t.Errorf("expected no missing files, got %d", len(got))
	}
}

func TestFilterMissingFiles_EmptyDir(t *testing.T) {
	tmp := t.TempDir()

	pending := []*model.File{
		{Filename: "a.csv.zip"},
		{Filename: "b.csv.zip"},
	}

	got := filterMissingFiles(pending, nil, tmp)

	if len(got) != 2 {
		t.Errorf("expected 2 missing files, got %d", len(got))
	}
}

func TestFilterMissingFiles_DedupesAgainstQueue(t *testing.T) {
	tmp := t.TempDir()

	pending := []*model.File{
		{Filename: "a.csv.zip"},
		{Filename: "b.csv.zip"},
	}
	queued := []*model.File{
		{Filename: "a.csv.zip"},
		{Filename: "b.csv.zip"},
	}

	got := filterMissingFiles(pending, queued, tmp)

	if len(got) != 0 {
		t.Errorf("expected 0 (all already queued), got %d", len(got))
	}
}

func write(t *testing.T, path string) {
	t.Helper()
	if err := os.WriteFile(path, []byte("test"), 0644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func equalStringSlices(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
