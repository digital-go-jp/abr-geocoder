// Package config loads and parses the import configuration stored in the database.
package config

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"abrdb/internal/infra/db"

	"abr.local/common/validate"

	"abrdb/internal/model"
)

// ImportConfig holds parsed configuration values
type ImportConfig struct {
	EnabledPref     []int
	EnabledCategory []model.FileCategory
	EnabledPos      bool
	Profile         string // Embedded import config profile name chosen at init
}

// LoadImportConfig loads and parses configuration from database.
func LoadImportConfig(ctx context.Context, executor *db.QueryExecutor) (*ImportConfig, error) {
	config, err := db.LoadABRDBConfig(ctx, executor)
	if err != nil {
		return nil, fmt.Errorf("load config: %w", err)
	}

	pref, err := ParsePref(config.EnabledPref)
	if err != nil {
		return nil, fmt.Errorf("parse pref: %w", err)
	}

	category, err := ParseCategory(config.EnabledCategory)
	if err != nil {
		return nil, fmt.Errorf("parse category: %w", err)
	}

	enablePos := config.EnabledPos == "true"

	return &ImportConfig{
		EnabledPref:     pref,
		EnabledCategory: category,
		EnabledPos:      enablePos,
		Profile:         config.ImportConfigProfile,
	}, nil
}

// Returns false if the config table doesn't exist (initial setup).
func CheckExistingData(ctx context.Context, executor *db.QueryExecutor) (bool, error) {
	config, err := db.LoadABRDBConfig(ctx, executor)
	if err != nil {
		if db.IsUndefinedTableError(err) {
			return false, nil
		}
		return false, fmt.Errorf("load config: %w", err)
	}

	return config != nil && (config.EnabledPref != "" || config.EnabledCategory != ""), nil
}

func ParsePref(input string) ([]int, error) {
	in := strings.TrimSpace(strings.ToLower(input))
	if in == "" || in == "all" {
		return model.AllPrefectureCodes(), nil
	}
	code, err := validate.ParsePrefectureCode(in)
	if err != nil {
		return nil, err
	}
	return []int{code}, nil
}

func ParseCategory(input string) ([]model.FileCategory, error) {
	in := strings.TrimSpace(strings.ToLower(input))
	switch in {
	case "":
		return []model.FileCategory{}, nil
	case "all":
		return slices.Clone(model.AllCategory), nil
	}

	if group := model.CategoryGroup(in); group != nil {
		return slices.Clone(group), nil
	}
	return nil, fmt.Errorf("invalid category group: %q", in)
}
