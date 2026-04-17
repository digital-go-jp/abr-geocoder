package catalog

import (
	"cmp"
	"slices"
	"strings"

	"abrdb/internal/model"
	"abrdb/internal/util"
)

// ParseFileInfo parses file information from filename
func ParseFileInfo(fileName string, category model.FileCategory) *model.File {
	fileType := model.FileTypeText
	if strings.Contains(fileName, "_pos") {
		fileType = model.FileTypePos
	}

	prefCode, fileKey := util.ExtractLocationInfo(fileName)

	return &model.File{
		FileType:     fileType,
		FileCategory: category,
		PrefCode:     prefCode,
		FileKey:      fileKey,
	}
}

// FilePairing represents a text/pos file pair
type FilePairing struct {
	TextFile *model.File
	PosFile  *model.File
}

// GroupFilesByPairKey groups files into text/position pairs
func GroupFilesByPairKey(files []*model.File) []FilePairing {
	pairByKey := make(map[string]FilePairing, len(files))

	for _, file := range files {
		pair := pairByKey[file.FileKey]
		switch file.FileType {
		case model.FileTypeText:
			pair.TextFile = file
		case model.FileTypePos:
			pair.PosFile = file
		}
		pairByKey[file.FileKey] = pair
	}

	// Collect valid pairs (must have TextFile)
	pairs := make([]FilePairing, 0, len(pairByKey))
	for _, pair := range pairByKey {
		if pair.TextFile != nil {
			pairs = append(pairs, pair)
		}
	}

	// Sort by prefecture code, then file key
	slices.SortFunc(pairs, func(a, b FilePairing) int {
		if c := cmp.Compare(a.TextFile.PrefCode, b.TextFile.PrefCode); c != 0 {
			return c
		}
		return strings.Compare(a.TextFile.FileKey, b.TextFile.FileKey)
	})

	return pairs
}
