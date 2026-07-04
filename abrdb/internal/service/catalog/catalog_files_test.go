package catalog

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"abrdb/internal/infra/api"
	"abrdb/internal/model"
)

func TestNewFileRecord(t *testing.T) {
	// info supplies the identity fields; file (api.FileInfo) supplies the
	// location/metadata. Filename/SourceURL/LastModified must come from file.
	info := &model.File{
		FileType:     model.FileTypeText,
		FileCategory: model.CategoryPref,
		PrefCode:     13,
		FileKey:      "mt_pref/13",
		Filename:     "INFO_FILENAME_UNUSED",
		SourceURL:    "INFO_URL_UNUSED",
		LastModified: time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC),
		UpdatedAt:    time.Date(1999, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	file := api.FileInfo{
		URL:          "https://host/mt_pref/mt_pref_all.csv.zip",
		Filename:     "mt_pref_all.csv.zip",
		LastModified: time.Date(2025, 5, 28, 9, 56, 52, 0, time.UTC),
	}

	got := newFileRecord(info, file, true, false)

	// Identity fields come from info.
	if got.FileType != info.FileType {
		t.Errorf("FileType = %q, want %q", got.FileType, info.FileType)
	}
	if got.FileCategory != info.FileCategory {
		t.Errorf("FileCategory = %q, want %q", got.FileCategory, info.FileCategory)
	}
	if got.PrefCode != info.PrefCode {
		t.Errorf("PrefCode = %d, want %d", got.PrefCode, info.PrefCode)
	}
	if got.FileKey != info.FileKey {
		t.Errorf("FileKey = %q, want %q", got.FileKey, info.FileKey)
	}
	// Location/metadata come from file, NOT info.
	if got.Filename != file.Filename {
		t.Errorf("Filename = %q, want %q (from file, not info)", got.Filename, file.Filename)
	}
	if got.SourceURL != file.URL {
		t.Errorf("SourceURL = %q, want %q (from file, not info)", got.SourceURL, file.URL)
	}
	if !got.LastModified.Equal(file.LastModified) {
		t.Errorf("LastModified = %v, want %v (from file)", got.LastModified, file.LastModified)
	}
	// Processing flags are passed through.
	if !got.NeedsDownload || got.NeedsImport {
		t.Errorf("NeedsDownload/NeedsImport = %v/%v, want true/false", got.NeedsDownload, got.NeedsImport)
	}
	// A fresh record does not carry info.UpdatedAt.
	if !got.UpdatedAt.IsZero() {
		t.Errorf("UpdatedAt = %v, want zero (not copied from info)", got.UpdatedAt)
	}
}

func TestBuildLocalFileSet(t *testing.T) {
	t.Run("missing directory returns empty set without error", func(t *testing.T) {
		set, err := buildLocalFileSet(filepath.Join(t.TempDir(), "does-not-exist"))
		if err != nil {
			t.Fatalf("err = %v, want nil for a missing dir", err)
		}
		if len(set) != 0 {
			t.Errorf("set = %v, want empty", set)
		}
	})

	t.Run("lists files and excludes subdirectories", func(t *testing.T) {
		dir := t.TempDir()
		for _, name := range []string{"a.csv.zip", "b.csv.zip"} {
			if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0o644); err != nil {
				t.Fatal(err)
			}
		}
		if err := os.Mkdir(filepath.Join(dir, "subdir"), 0o755); err != nil {
			t.Fatal(err)
		}

		set, err := buildLocalFileSet(dir)
		if err != nil {
			t.Fatalf("err = %v", err)
		}
		if len(set) != 2 {
			t.Fatalf("set = %v, want 2 files", set)
		}
		for _, name := range []string{"a.csv.zip", "b.csv.zip"} {
			if _, ok := set[name]; !ok {
				t.Errorf("missing %q in set", name)
			}
		}
		if _, ok := set["subdir"]; ok {
			t.Error("subdir should be excluded from the set")
		}
	})

	t.Run("empty directory returns empty set", func(t *testing.T) {
		set, err := buildLocalFileSet(t.TempDir())
		if err != nil {
			t.Fatalf("err = %v", err)
		}
		if len(set) != 0 {
			t.Errorf("set = %v, want empty", set)
		}
	})
}
