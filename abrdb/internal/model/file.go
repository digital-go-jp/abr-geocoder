package model

import "time"

type FileType string

const (
	FileTypeText FileType = "text"
	FileTypePos  FileType = "pos"
)

type File struct {
	// Identification
	FileType     FileType
	FileCategory FileCategory
	PrefCode     int
	FileKey      string

	// Location
	Filename string // unique key

	// Metadata
	LastModified time.Time
	SourceURL    string

	// Processing status
	NeedsDownload bool
	NeedsImport   bool
	UpdatedAt     time.Time
}
