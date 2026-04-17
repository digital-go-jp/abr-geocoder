package catalog

import (
	"fmt"
	"reflect"
	"slices"
	"strings"
	"testing"

	"abrdb/internal/model"
)

func TestFileNameParser_ParseFileInfo(t *testing.T) {
	tests := []struct {
		name         string
		fileName     string
		category     string
		wantFileType model.FileType
		wantPrefCode int
		wantFileKey  string
	}{
		{
			name:         "mt_pref_all.csv",
			fileName:     "mt_pref_all.csv.zip",
			category:     "mt_pref",
			wantFileType: model.FileType("text"),
			wantPrefCode: 0,
			wantFileKey:  "all",
		},
		{
			name:         "mt_pref_pos_all.csv",
			fileName:     "mt_pref_pos_all.csv.zip",
			category:     "mt_pref",
			wantFileType: model.FileType("pos"),
			wantPrefCode: 0,
			wantFileKey:  "all",
		},
		{
			name:         "mt_city_all.csv",
			fileName:     "mt_city_all.csv.zip",
			category:     "mt_city",
			wantFileType: model.FileType("text"),
			wantPrefCode: 0,
			wantFileKey:  "all",
		},
		{
			name:         "mt_city_pref13.csv",
			fileName:     "mt_city_pref13.csv.zip",
			category:     "mt_city",
			wantFileType: model.FileType("text"),
			wantPrefCode: 13,
			wantFileKey:  "13",
		},
		{
			name:         "mt_city_pos_pref13.csv",
			fileName:     "mt_city_pos_pref13.csv.zip",
			category:     "mt_city",
			wantFileType: model.FileType("pos"),
			wantPrefCode: 13,
			wantFileKey:  "13",
		},
		{
			name:         "mt_parcel_city011011.csv",
			fileName:     "mt_parcel_city011011.csv.zip",
			category:     "mt_parcel",
			wantFileType: model.FileType("text"),
			wantPrefCode: 1,
			wantFileKey:  "011011",
		},
		{
			name:         "mt_parcel_pos_city131011.csv",
			fileName:     "mt_parcel_pos_city131011.csv.zip",
			category:     "mt_parcel",
			wantFileType: model.FileType("pos"),
			wantPrefCode: 13,
			wantFileKey:  "131011",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ParseFileInfo(tt.fileName, model.FileCategory(tt.category))

			if got.FileType != tt.wantFileType {
				t.Errorf("FileType = %v, want %v", got.FileType, tt.wantFileType)
			}
			if got.PrefCode != tt.wantPrefCode {
				t.Errorf("PrefCode = %v, want %v", got.PrefCode, tt.wantPrefCode)
			}
			if got.FileKey != tt.wantFileKey {
				t.Errorf("FileKey = %v, want %v", got.FileKey, tt.wantFileKey)
			}
		})
	}
}

func TestFilePairingService_GroupFilesByPairKey(t *testing.T) {
	tests := []struct {
		name  string
		files []*model.File
		want  []FilePairing
	}{
		{
			name:  "empty files",
			files: []*model.File{},
			want:  []FilePairing{},
		},
		{
			name: "single text file only",
			files: []*model.File{
				{
					Filename: "mt_pref_all.csv.zip",
					FileKey:  "mt_pref_all",
					FileType: model.FileTypeText,
					PrefCode: 0,
				},
			},
			want: []FilePairing{
				{
					TextFile: &model.File{
						Filename: "mt_pref_all.csv.zip",
						FileKey:  "mt_pref_all",
						FileType: model.FileTypeText,
						PrefCode: 0,
					},
					PosFile: nil,
				},
			},
		},
		{
			name: "matched text and pos files",
			files: []*model.File{
				{
					Filename: "mt_city_pref13.csv.zip",
					FileKey:  "mt_city_pref13",
					FileType: model.FileTypeText,
					PrefCode: 13,
				},
				{
					Filename: "mt_city_pos_pref13.csv.zip",
					FileKey:  "mt_city_pref13",
					FileType: model.FileTypePos,
					PrefCode: 13,
				},
			},
			want: []FilePairing{
				{
					TextFile: &model.File{
						Filename: "mt_city_pref13.csv.zip",
						FileKey:  "mt_city_pref13",
						FileType: model.FileTypeText,
						PrefCode: 13,
					},
					PosFile: &model.File{
						Filename: "mt_city_pos_pref13.csv.zip",
						FileKey:  "mt_city_pref13",
						FileType: model.FileTypePos,
						PrefCode: 13,
					},
				},
			},
		},
		{
			name: "multiple prefectures with mixed pairing",
			files: []*model.File{
				{
					Filename: "mt_town_pref01.csv.zip",
					FileKey:  "mt_town_pref01",
					FileType: model.FileTypeText,
					PrefCode: 1,
				},
				{
					Filename: "mt_town_pref13.csv.zip",
					FileKey:  "mt_town_pref13",
					FileType: model.FileTypeText,
					PrefCode: 13,
				},
				{
					Filename: "mt_town_pos_pref13.csv.zip",
					FileKey:  "mt_town_pref13",
					FileType: model.FileTypePos,
					PrefCode: 13,
				},
				{
					Filename: "mt_town_pref27.csv.zip",
					FileKey:  "mt_town_pref27",
					FileType: model.FileTypeText,
					PrefCode: 27,
				},
			},
			want: []FilePairing{
				{
					TextFile: &model.File{
						Filename: "mt_town_pref01.csv.zip",
						FileKey:  "mt_town_pref01",
						FileType: model.FileTypeText,
						PrefCode: 1,
					},
					PosFile: nil,
				},
				{
					TextFile: &model.File{
						Filename: "mt_town_pref13.csv.zip",
						FileKey:  "mt_town_pref13",
						FileType: model.FileTypeText,
						PrefCode: 13,
					},
					PosFile: &model.File{
						Filename: "mt_town_pos_pref13.csv.zip",
						FileKey:  "mt_town_pref13",
						FileType: model.FileTypePos,
						PrefCode: 13,
					},
				},
				{
					TextFile: &model.File{
						Filename: "mt_town_pref27.csv.zip",
						FileKey:  "mt_town_pref27",
						FileType: model.FileTypeText,
						PrefCode: 27,
					},
					PosFile: nil,
				},
			},
		},
		{
			name: "pos file without text file",
			files: []*model.File{
				{
					Filename: "mt_parcel_pos_pref40.csv.zip",
					FileKey:  "mt_parcel_pref40",
					FileType: model.FileTypePos,
					PrefCode: 40,
				},
			},
			want: []FilePairing{}, // Pairs without TextFile are filtered out
		},
		{
			name: "all category with text and pos",
			files: []*model.File{
				{
					Filename: "mt_pref_all.csv.zip",
					FileKey:  "mt_pref_all",
					FileType: model.FileTypeText,
					PrefCode: 0,
				},
				{
					Filename: "mt_pref_pos_all.csv.zip",
					FileKey:  "mt_pref_all",
					FileType: model.FileTypePos,
					PrefCode: 0,
				},
			},
			want: []FilePairing{
				{
					TextFile: &model.File{
						Filename: "mt_pref_all.csv.zip",
						FileKey:  "mt_pref_all",
						FileType: model.FileTypeText,
						PrefCode: 0,
					},
					PosFile: &model.File{
						Filename: "mt_pref_pos_all.csv.zip",
						FileKey:  "mt_pref_all",
						FileType: model.FileTypePos,
						PrefCode: 0,
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := GroupFilesByPairKey(tt.files)

			// Sort results for consistent comparison
			sortPairings(got)
			sortPairings(tt.want)

			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("GroupFilesByPairKey() = %v, want %v", got, tt.want)
			}
		})
	}
}

// Helper function to sort pairings for consistent test comparison
func sortPairings(pairings []FilePairing) {
	// Sort by FileKey (from either TextFile or PosFile)
	slices.SortFunc(pairings, func(a, b FilePairing) int {
		aKey := getFileKey(a)
		bKey := getFileKey(b)
		return strings.Compare(aKey, bKey)
	})
}

func getFileKey(p FilePairing) string {
	if p.TextFile != nil {
		return p.TextFile.FileKey
	}
	if p.PosFile != nil {
		return p.PosFile.FileKey
	}
	return ""
}

func TestFilePairingService_EdgeCases(t *testing.T) {
	t.Run("nil input", func(t *testing.T) {
		got := GroupFilesByPairKey(nil)
		if len(got) != 0 {
			t.Errorf("expected empty result for nil input, got %v", got)
		}
	})

	t.Run("duplicate file keys", func(t *testing.T) {
		files := []*model.File{
			{
				Filename: "mt_city_pref13_v1.csv.zip",
				FileKey:  "mt_city_pref13",
				FileType: model.FileTypeText,
				PrefCode: 13,
			},
			{
				Filename: "mt_city_pref13_v2.csv.zip",
				FileKey:  "mt_city_pref13",
				FileType: model.FileTypeText,
				PrefCode: 13,
			},
		}

		got := GroupFilesByPairKey(files)
		if len(got) != 1 {
			t.Errorf("expected 1 pairing for duplicate keys, got %d", len(got))
		}

		// Should keep the last file
		if got[0].TextFile.Filename != "mt_city_pref13_v2.csv.zip" {
			t.Errorf("expected last file to be kept, got file %s", got[0].TextFile.Filename)
		}
	})

	t.Run("unknown file type", func(t *testing.T) {
		files := []*model.File{
			{
				Filename: "unknown_file.csv.zip",
				FileKey:  "unknown_file",
				FileType: "unknown",
				PrefCode: 1,
			},
		}

		got := GroupFilesByPairKey(files)
		if len(got) != 0 {
			t.Errorf("expected 0 pairings for unknown file type, got %d", len(got))
		}
	})
}

// Benchmark tests
func BenchmarkFilePairingService_GroupFilesByPairKey(b *testing.B) {

	// Create test data with various sizes
	sizes := []int{10, 100, 1000, 10000}

	for _, size := range sizes {
		files := make([]*model.File, size*2) // text + pos files
		for i := range size {
			files[i*2] = &model.File{
				Filename: fmt.Sprintf("mt_city_pref%02d.csv.zip", i%47+1),
				FileKey:  fmt.Sprintf("mt_city_pref%02d", i%47+1),
				FileType: model.FileTypeText,
				PrefCode: i%47 + 1,
			}
			files[i*2+1] = &model.File{
				Filename: fmt.Sprintf("mt_city_pos_pref%02d.csv.zip", i%47+1),
				FileKey:  fmt.Sprintf("mt_city_pref%02d", i%47+1),
				FileType: model.FileTypePos,
				PrefCode: i%47 + 1,
			}
		}

		b.Run(fmt.Sprintf("files_%d", size*2), func(b *testing.B) {
			for b.Loop() {
				_ = GroupFilesByPairKey(files)
			}
		})
	}
}
