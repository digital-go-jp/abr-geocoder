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

func TestDecideFileAction(t *testing.T) {
	modA := time.Date(2025, 5, 28, 9, 0, 0, 0, time.UTC)
	modB := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC) // different timestamp
	file := api.FileInfo{URL: "https://host/f.csv.zip", Filename: "f.csv.zip", LastModified: modA}

	// existing catalog record helpers.
	unchanged := &model.File{LastModified: modA, NeedsImport: false}
	unchangedPendingImport := &model.File{LastModified: modA, NeedsImport: true}
	modified := &model.File{LastModified: modB, NeedsImport: false}

	tests := []struct {
		name       string
		existing   *model.File
		localExist bool
		updateDB   bool
		force      bool
		want       fileAction
	}{
		// --- dry-run (updateDB=false) ---
		{
			name:     "dry-run: brand-new file, absent locally",
			existing: nil, localExist: false, updateDB: false,
			want: fileAction{needsDownload: true, needsImport: true, isNewOrModified: true},
		},
		{
			name:     "dry-run: new file already present locally",
			existing: nil, localExist: true, updateDB: false,
			want: fileAction{needsDownload: false, needsImport: true, isNewOrModified: true},
		},
		{
			name:     "dry-run: modified file is a candidate",
			existing: modified, localExist: true, updateDB: false,
			want: fileAction{needsDownload: false, needsImport: true, isNewOrModified: true},
		},
		{
			name:     "dry-run: unchanged file is skipped",
			existing: unchanged, localExist: true, updateDB: false,
			want: fileAction{skip: true},
		},
		// --- update (updateDB=true) ---
		{
			name:     "update: brand-new file needs download and import",
			existing: nil, localExist: false, updateDB: true,
			want: fileAction{needsDownload: true, needsImport: true, isNewOrModified: true},
		},
		{
			name:     "update: modified file re-downloads and re-imports",
			existing: modified, localExist: true, updateDB: true,
			want: fileAction{needsDownload: true, needsImport: true, isNewOrModified: true},
		},
		{
			name:     "update: unchanged and already imported is skipped",
			existing: unchanged, localExist: true, updateDB: true,
			want: fileAction{skip: true},
		},
		{
			// Unchanged on S3 but a prior import never completed: must not skip,
			// and must re-import without re-downloading (already local, not modified).
			name:     "update: unchanged but import still pending",
			existing: unchangedPendingImport, localExist: true, updateDB: true,
			want: fileAction{needsDownload: false, needsImport: true, isNewOrModified: false},
		},
		{
			// Same pending-import case but the local file went missing: re-download too.
			name:     "update: pending import with missing local file",
			existing: unchangedPendingImport, localExist: false, updateDB: true,
			want: fileAction{needsDownload: true, needsImport: true, isNewOrModified: false},
		},
		// --- force (updateDB=true, force=true): re-import everything in scope ---
		{
			// Unchanged and already imported would normally be skipped; force
			// re-downloads and re-imports it so a config/filter change is re-applied.
			name:     "force: unchanged already-imported re-downloads and re-imports",
			existing: unchanged, localExist: true, updateDB: true, force: true,
			want: fileAction{needsDownload: true, needsImport: true, isNewOrModified: false},
		},
		{
			// A brand-new file is still upserted under force (existing==nil path),
			// so files added since the last import are not missed.
			name:     "force: brand-new file still downloaded and imported",
			existing: nil, localExist: false, updateDB: true, force: true,
			want: fileAction{needsDownload: true, needsImport: true, isNewOrModified: true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := decideFileAction(tt.existing, file, tt.localExist, tt.updateDB, tt.force)
			if got != tt.want {
				t.Errorf("decideFileAction() = %+v, want %+v", got, tt.want)
			}
		})
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
