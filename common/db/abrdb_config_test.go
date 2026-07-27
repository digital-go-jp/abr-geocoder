package db

import (
	"errors"
	"testing"
)

// fakeConfigRows feeds key/value pairs through the ConfigRows interface.
type fakeConfigRows struct {
	pairs   [][2]string
	pos     int
	scanErr error
	iterErr error
}

func (f *fakeConfigRows) Next() bool {
	return f.pos < len(f.pairs)
}

func (f *fakeConfigRows) Scan(dest ...any) error {
	if f.scanErr != nil {
		return f.scanErr
	}
	pair := f.pairs[f.pos]
	f.pos++
	*(dest[0].(*string)) = pair[0]
	*(dest[1].(*string)) = pair[1]
	return nil
}

func (f *fakeConfigRows) Err() error {
	return f.iterErr
}

func TestScanABRDBConfig(t *testing.T) {
	rows := &fakeConfigRows{pairs: [][2]string{
		{KeyABRDBVersion, "3.0.13"},
		{KeyEnabledPref, "all"},
		{KeyEnabledCategory, "all"},
		{KeyEnabledPos, "true"},
		{KeyImportConfigProfile, "default"},
		{"unknown_key", "ignored"},
	}}

	got, err := ScanABRDBConfig(rows)
	if err != nil {
		t.Fatalf("ScanABRDBConfig() error = %v", err)
	}

	want := ABRDBConfig{
		Version:             "3.0.13",
		EnabledPref:         "all",
		EnabledCategory:     "all",
		EnabledPos:          "true",
		ImportConfigProfile: "default",
	}
	if *got != want {
		t.Errorf("ScanABRDBConfig() = %+v, want %+v", *got, want)
	}
}

func TestScanABRDBConfig_Empty(t *testing.T) {
	got, err := ScanABRDBConfig(&fakeConfigRows{})
	if err != nil {
		t.Fatalf("ScanABRDBConfig() error = %v", err)
	}
	if *got != (ABRDBConfig{}) {
		t.Errorf("ScanABRDBConfig() = %+v, want zero value", *got)
	}
}

func TestScanABRDBConfig_ScanError(t *testing.T) {
	scanErr := errors.New("boom")
	_, err := ScanABRDBConfig(&fakeConfigRows{
		pairs:   [][2]string{{KeyABRDBVersion, "1"}},
		scanErr: scanErr,
	})
	if !errors.Is(err, scanErr) {
		t.Errorf("ScanABRDBConfig() error = %v, want wrapped %v", err, scanErr)
	}
}

func TestScanABRDBConfig_IterError(t *testing.T) {
	iterErr := errors.New("iteration failed")
	_, err := ScanABRDBConfig(&fakeConfigRows{iterErr: iterErr})
	if !errors.Is(err, iterErr) {
		t.Errorf("ScanABRDBConfig() error = %v, want wrapped %v", err, iterErr)
	}
}
