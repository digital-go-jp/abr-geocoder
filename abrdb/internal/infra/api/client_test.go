package api

import (
	"testing"
	"time"
)

func TestExtractModifiedFromDescription(t *testing.T) {
	tests := []struct {
		name        string
		description string
		wantTime    string // RFC3339 format for easy comparison
		wantErr     bool
	}{
		{
			name:        "valid description with timestamp",
			description: "最終更新日: 2025-05-28T09:56:52.000Z",
			wantTime:    "2025-05-28T09:56:52.000Z",
			wantErr:     false,
		},
		{
			name:        "valid description with different timestamp",
			description: "最終更新日: 2024-12-01T15:30:45.000Z",
			wantTime:    "2024-12-01T15:30:45.000Z",
			wantErr:     false,
		},
		{
			name:        "description with extra text before",
			description: "データセット説明。最終更新日: 2025-01-15T10:00:00.000Z",
			wantTime:    "2025-01-15T10:00:00.000Z",
			wantErr:     false,
		},
		{
			name:        "description with extra text after",
			description: "最終更新日: 2025-03-20T08:15:30.000Z その他の情報",
			wantTime:    "2025-03-20T08:15:30.000Z",
			wantErr:     false,
		},
		{
			name:        "description without timestamp prefix",
			description: "2025-05-28T09:56:52.000Z",
			wantErr:     true,
		},
		{
			name:        "empty description",
			description: "",
			wantErr:     true,
		},
		{
			name:        "description with prefix but invalid timestamp",
			description: "最終更新日: invalid-date",
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := extractModifiedFromDescription(tt.description)

			if tt.wantErr {
				if err == nil {
					t.Errorf("extractModifiedFromDescription() expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("extractModifiedFromDescription() unexpected error: %v", err)
				return
			}

			// Parse expected time
			want, err := time.Parse(time.RFC3339, tt.wantTime)
			if err != nil {
				t.Fatalf("failed to parse wantTime: %v", err)
			}

			if !got.Equal(want) {
				t.Errorf("extractModifiedFromDescription() = %v, want %v", got, want)
			}
		})
	}
}

func TestParseModifiedDate(t *testing.T) {
	tests := []struct {
		name     string
		dateStr  string
		wantTime string // RFC3339 format for easy comparison
		wantErr  bool
	}{
		{
			name:     "valid API format",
			dateStr:  "2025-05-28T09:56:52.000Z",
			wantTime: "2025-05-28T09:56:52Z",
			wantErr:  false,
		},
		{
			name:     "another valid timestamp",
			dateStr:  "2024-12-01T15:30:45.000Z",
			wantTime: "2024-12-01T15:30:45Z",
			wantErr:  false,
		},
		{
			name:    "wrong format - no milliseconds",
			dateStr: "2025-05-28T09:56:52Z",
			wantErr: true,
		},
		{
			name:    "wrong format - date only",
			dateStr: "2025-05-28",
			wantErr: true,
		},
		{
			name:    "invalid date format",
			dateStr: "invalid-date",
			wantErr: true,
		},
		{
			name:    "empty string",
			dateStr: "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseModifiedDate(tt.dateStr)

			if tt.wantErr {
				if err == nil {
					t.Errorf("parseModifiedDate() expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("parseModifiedDate() unexpected error: %v", err)
				return
			}

			// Parse expected time
			want, err := time.Parse(time.RFC3339, tt.wantTime)
			if err != nil {
				t.Fatalf("failed to parse wantTime: %v", err)
			}

			if !got.Equal(want) {
				t.Errorf("parseModifiedDate() = %v, want %v", got, want)
			}
		})
	}
}
