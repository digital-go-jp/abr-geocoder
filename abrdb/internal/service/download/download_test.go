package download

import (
	"testing"
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
		if svc.executor != nil {
			t.Error("executor should be nil")
		}
		if svc.progress != nil {
			t.Error("progress should be nil")
		}
		if svc.downloadDir != "/data/downloads" {
			t.Errorf("downloadDir = %q, want %q", svc.downloadDir, "/data/downloads")
		}
	})
}
