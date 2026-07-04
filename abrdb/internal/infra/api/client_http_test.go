package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"
)

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

	files, err := New(server.URL).ListFilesByPrefix(context.Background(), "mt_pref")
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
	if err := New(server.URL).DownloadFile(context.Background(), server.URL+"/f.csv.zip", destPath); err != nil {
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

	destPath := filepath.Join(t.TempDir(), "mt_pref_all.csv.zip")
	err := New(server.URL).DownloadFile(context.Background(), server.URL+"/f.csv.zip", destPath)
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
	var callCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if callCount.Add(1) == 1 {
			w.WriteHeader(http.StatusInternalServerError) // first call fails
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"dataset":[]}`))
	}))
	defer server.Close()

	client := New(server.URL)
	ctx := context.Background()

	// A failed fetch must not be cached...
	if _, err := client.FetchFeed(ctx); err == nil {
		t.Fatal("first FetchFeed: want error on 500, got nil")
	}
	// ...so the next call re-fetches and succeeds.
	if _, err := client.FetchFeed(ctx); err != nil {
		t.Fatalf("second FetchFeed: want success, got %v", err)
	}
	if got := callCount.Load(); got != 2 {
		t.Errorf("HTTP calls = %d, want 2 (error must trigger a refetch)", got)
	}
}

func TestFetchFeed_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{not valid json`))
	}))
	defer server.Close()

	if _, err := New(server.URL).FetchFeed(context.Background()); err == nil {
		t.Error("FetchFeed: want decode error for invalid JSON, got nil")
	}
}
