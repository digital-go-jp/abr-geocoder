package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestNewClientHonorsProxyEnv(t *testing.T) {
	// The download client must route through HTTP(S)_PROXY when set (corporate
	// proxy environments). A hand-built http.Transport defaults to Proxy=nil,
	// which silently ignores the proxy env vars — this guards against that.
	tr, ok := New("https://example.com/feed.json").httpClient.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("Transport is %T, want *http.Transport", New("").httpClient.Transport)
	}
	// A hand-built http.Transport defaults to Proxy=nil, which silently ignores
	// HTTP_PROXY/HTTPS_PROXY. The client must set Proxy so corporate proxy
	// environments work.
	if tr.Proxy == nil {
		t.Fatal("Transport.Proxy is nil; HTTP_PROXY/HTTPS_PROXY would be ignored")
	}
}

func TestMatchesPrefix(t *testing.T) {
	tests := []struct {
		name    string
		fileURL string
		prefix  string
		want    bool
	}{
		{
			name:    "prefix followed by slash",
			fileURL: "https://host/mt_pref/mt_pref_all.csv.zip",
			prefix:  "mt_pref",
			want:    true,
		},
		{
			name:    "exact path match",
			fileURL: "https://host/mt_pref",
			prefix:  "mt_pref",
			want:    true,
		},
		{
			// The key boundary: mt_pref must not match mt_pref_pos.
			name:    "sibling prefix is not a match",
			fileURL: "https://host/mt_pref_pos/mt_pref_pos_all.csv.zip",
			prefix:  "mt_pref",
			want:    false,
		},
		{
			name:    "nested prefix",
			fileURL: "https://host/mt_city/pref/01.csv.zip",
			prefix:  "mt_city/pref",
			want:    true,
		},
		{
			name:    "surrounding slashes on prefix are trimmed",
			fileURL: "https://host/mt_pref/x.csv.zip",
			prefix:  "/mt_pref/",
			want:    true,
		},
		{
			name:    "different prefix does not match",
			fileURL: "https://host/mt_town/x.csv.zip",
			prefix:  "mt_pref",
			want:    false,
		},
		{
			name:    "unparseable URL returns false",
			fileURL: "https://host/%zz",
			prefix:  "mt_pref",
			want:    false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := matchesPrefix(tt.fileURL, tt.prefix); got != tt.want {
				t.Errorf("matchesPrefix(%q, %q) = %v, want %v", tt.fileURL, tt.prefix, got, tt.want)
			}
		})
	}
}

// dcatFeed is a DCAT feed body: only .csv.zip files under the requested prefix
// with a parseable "最終更新日" timestamp are expected to be listed.
const dcatFeed = `{
  "dataset": [
    {
      "description": "最終更新日: 2025-05-28T09:56:52.000Z",
      "distribution": [
        {"accessURL": "https://host/mt_pref/mt_pref_all.csv.zip"},
        {"accessURL": "https://host/mt_pref/mt_pref_all.csv"},
        {"accessURL": "https://host/mt_pref_pos/mt_pref_pos_all.csv.zip"}
      ]
    },
    {
      "description": "no timestamp here",
      "distribution": [
        {"accessURL": "https://host/mt_pref/mt_pref_notime.csv.zip"}
      ]
    },
    {
      "description": "最終更新日: 2025-05-28T09:56:52.000Z",
      "distribution": [
        {"accessURL": "https://host/mt_town/mt_town_all.csv.zip"}
      ]
    }
  ]
}`

func TestListFilesByPrefix(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(dcatFeed))
	}))
	defer server.Close()

	files, err := New(server.URL).ListFilesByPrefix(t.Context(), "mt_pref")
	if err != nil {
		t.Fatalf("ListFilesByPrefix: %v", err)
	}

	// Only the .csv.zip under mt_pref/ with a valid timestamp qualifies:
	// the .csv (non-zip), mt_pref_pos/ (sibling prefix), missing-timestamp, and
	// mt_town/ (different prefix) entries must all be filtered out.
	if len(files) != 1 {
		t.Fatalf("got %d files, want 1: %+v", len(files), files)
	}
	got := files[0]
	if got.URL != "https://host/mt_pref/mt_pref_all.csv.zip" {
		t.Errorf("URL = %q", got.URL)
	}
	if got.Filename != "mt_pref_all.csv.zip" {
		t.Errorf("Filename = %q, want mt_pref_all.csv.zip", got.Filename)
	}
	wantTime := time.Date(2025, 5, 28, 9, 56, 52, 0, time.UTC)
	if !got.LastModified.Equal(wantTime) {
		t.Errorf("LastModified = %v, want %v", got.LastModified, wantTime)
	}
}

func TestDownloadFile_Success(t *testing.T) {
	const body = "parcel data payload"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(body))
	}))
	defer server.Close()

	// destPath is in a not-yet-existing subdirectory to also cover MkdirAll.
	destPath := filepath.Join(t.TempDir(), "sub", "mt_pref_all.csv.zip")
	if err := New(server.URL).DownloadFile(t.Context(), server.URL+"/f.csv.zip", destPath); err != nil {
		t.Fatalf("DownloadFile: %v", err)
	}

	data, err := os.ReadFile(destPath)
	if err != nil {
		t.Fatalf("read dest: %v", err)
	}
	if string(data) != body {
		t.Errorf("content = %q, want %q", data, body)
	}
	// The atomic-write temp file must not be left behind on success.
	if _, err := os.Stat(destPath + ".tmp"); !os.IsNotExist(err) {
		t.Errorf(".tmp file should not remain, stat err = %v", err)
	}
}

func TestDownloadFile_Non200LeavesNoFiles(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client, _ := newFastRetryClient(server.URL)
	destPath := filepath.Join(t.TempDir(), "mt_pref_all.csv.zip")
	err := client.DownloadFile(t.Context(), server.URL+"/f.csv.zip", destPath)
	if err == nil {
		t.Fatal("DownloadFile: want error on 500, got nil")
	}
	// Neither the destination nor the temp file may exist after a failed download.
	if _, statErr := os.Stat(destPath); !os.IsNotExist(statErr) {
		t.Errorf("dest file should not exist, stat err = %v", statErr)
	}
	if _, statErr := os.Stat(destPath + ".tmp"); !os.IsNotExist(statErr) {
		t.Errorf(".tmp file should not exist, stat err = %v", statErr)
	}
}

func TestFetchFeed_RefetchesAfterError(t *testing.T) {
	// The first logical fetch must exhaust every retry (1 + 3 retries = 4
	// requests) before FetchFeed reports the error; the next call re-fetches.
	var callCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if callCount.Add(1) <= 4 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"dataset":[]}`))
	}))
	defer server.Close()

	client, _ := newFastRetryClient(server.URL)
	ctx := t.Context()

	// A failed fetch must not be cached...
	if _, err := client.FetchFeed(ctx); err == nil {
		t.Fatal("first FetchFeed: want error on 500, got nil")
	}
	// ...so the next call re-fetches and succeeds.
	if _, err := client.FetchFeed(ctx); err != nil {
		t.Fatalf("second FetchFeed: want success, got %v", err)
	}
	if got := callCount.Load(); got != 5 {
		t.Errorf("HTTP calls = %d, want 5 (4 exhausted attempts + refetch)", got)
	}
}

func TestFetchFeed_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{not valid json`))
	}))
	defer server.Close()

	if _, err := New(server.URL).FetchFeed(t.Context()); err == nil {
		t.Error("FetchFeed: want decode error for invalid JSON, got nil")
	}
}

// TestListFilesByPrefix_AllTimestampsUnparsable pins that a feed whose every
// matching entry lacks a parseable timestamp is reported as an error rather
// than an empty "no changes" result.
func TestListFilesByPrefix_AllTimestampsUnparsable(t *testing.T) {
	const feed = `{
  "dataset": [
    {
      "description": "no timestamp here",
      "distribution": [
        {"accessURL": "https://host/mt_pref/mt_pref_all.csv.zip"},
        {"accessURL": "https://host/mt_pref/mt_pref_02.csv.zip"}
      ]
    }
  ]
}`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(feed))
	}))
	defer server.Close()

	_, err := New(server.URL).ListFilesByPrefix(t.Context(), "mt_pref")
	if err == nil {
		t.Fatal("ListFilesByPrefix() = nil, want error when all timestamps are unparsable")
	}
	if !strings.Contains(err.Error(), "DCAT feed format may have changed") {
		t.Errorf("error = %v, want mention of feed format change", err)
	}
}

// TestListFilesByPrefix_NoMatchesIsNotAnError pins that a prefix with no
// matching files at all still returns an empty list without error.
func TestListFilesByPrefix_NoMatchesIsNotAnError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(dcatFeed))
	}))
	defer server.Close()

	files, err := New(server.URL).ListFilesByPrefix(t.Context(), "mt_nonexistent")
	if err != nil {
		t.Fatalf("ListFilesByPrefix() error = %v, want nil", err)
	}
	if len(files) != 0 {
		t.Errorf("got %d files, want 0", len(files))
	}
}

// TestDownloadFile_LeavesOnlyFinalFile pins the atomic-write contract: after a
// successful download the destination directory contains only the final file,
// with no temp leftovers.
func TestDownloadFile_LeavesOnlyFinalFile(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("payload"))
	}))
	defer server.Close()

	dir := t.TempDir()
	dest := filepath.Join(dir, "data.csv.zip")
	if err := New(server.URL).DownloadFile(t.Context(), server.URL, dest); err != nil {
		t.Fatalf("DownloadFile() error = %v", err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir: %v", err)
	}
	if len(entries) != 1 || entries[0].Name() != "data.csv.zip" {
		names := make([]string, 0, len(entries))
		for _, e := range entries {
			names = append(names, e.Name())
		}
		t.Errorf("directory contents = %v, want only data.csv.zip", names)
	}

	// The final file must carry the same 0666-minus-umask permissions that
	// os.Create gives. A reference file makes the check umask-independent.
	ref, err := os.Create(filepath.Join(dir, "reference"))
	if err != nil {
		t.Fatalf("create reference file: %v", err)
	}
	_ = ref.Close()
	refInfo, err := os.Stat(ref.Name())
	if err != nil {
		t.Fatalf("stat reference file: %v", err)
	}
	gotInfo, err := os.Stat(dest)
	if err != nil {
		t.Fatalf("stat downloaded file: %v", err)
	}
	if gotInfo.Mode().Perm() != refInfo.Mode().Perm() {
		t.Errorf("downloaded file mode = %v, want %v (0666 &^ umask)", gotInfo.Mode().Perm(), refInfo.Mode().Perm())
	}
}
