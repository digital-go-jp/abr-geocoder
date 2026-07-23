package issues

import (
	"testing"

	"abrg/internal/cache"
	"abrg/internal/matching"
	"abrg/internal/model"
	"abrg/internal/repository"
	"abrg/internal/testutil"
)

var initTestNormalizer = testutil.NewCacheOnce(func(c *cache.DuckDBCache) (matching.Matcher, error) {
	return matching.NewMatcher(repository.NewRepository(c.DB()), c.Lookups()), nil
})

type normalizeTestCase struct {
	name               string
	query              model.MatchQuery
	wantMatchLevel     model.MatchLevel
	wantMatchedAddress string
	// wantUnmatchedAddress behavior:
	//   - nil: expect empty (nil or []) - fully matched
	//   - []string{}: skip validation
	//   - []string{"..."}: expect specific unmatched parts
	wantUnmatchedAddress []string
	// wantStructured: map[string]any for structured address fields
	// Keys: use Field* constants (e.g., FieldPref, FieldCity)
	// Values: nil = expect nil, "" = expect empty string, "value" = expect that value
	// Omitted keys are not validated (skip)
	wantStructured map[string]any
}

// StructuredAddress field name constants for test assertions.
const (
	FieldPref         = "pref"
	FieldCounty       = "county"
	FieldCity         = "city"
	FieldWard         = "ward"
	FieldKyotoSt      = "kyoto_st"
	FieldOazaCho      = "oaza_cho"
	FieldChome        = "chome"
	FieldKoaza        = "koaza"
	FieldMachiazaDist = "machiaza_dist"
	FieldBlkNum       = "blk_num"
	FieldRsdtNum      = "rsdt_num"
	FieldRsdtNum2     = "rsdt_num2"
	FieldPrcNum1      = "prc_num1"
	FieldPrcNum2      = "prc_num2"
	FieldPrcNum3      = "prc_num3"
)

func setupTestNormalizer(t *testing.T) matching.Matcher {
	t.Helper()
	return testutil.Setup(t, initTestNormalizer)
}

// checkStructuredAddress validates structured address fields against expected values.
// Expected map values: nil = expect nil, "" = expect empty string, "value" = expect that value.
// Omitted keys are not validated.
func checkStructuredAddress(t *testing.T, sa model.StructuredAddress, expected map[string]any) {
	t.Helper()
	if expected == nil {
		return
	}

	fieldMap := map[string]*string{
		FieldPref:         sa.Pref,
		FieldCounty:       sa.County,
		FieldCity:         sa.City,
		FieldWard:         sa.Ward,
		FieldKyotoSt:      sa.KyotoSt,
		FieldOazaCho:      sa.OazaCho,
		FieldChome:        sa.Chome,
		FieldKoaza:        sa.Koaza,
		FieldMachiazaDist: sa.MachiazaDist,
		FieldBlkNum:       sa.BlkNum,
		FieldRsdtNum:      sa.RsdtNum,
		FieldRsdtNum2:     sa.RsdtNum2,
		FieldPrcNum1:      sa.PrcNum1,
		FieldPrcNum2:      sa.PrcNum2,
		FieldPrcNum3:      sa.PrcNum3,
	}

	for key, expectedVal := range expected {
		actual, ok := fieldMap[key]
		if !ok {
			t.Errorf("unknown structured address field: %s", key)
			continue
		}
		checkFieldValue(t, key, actual, expectedVal)
	}
}

// checkFieldValue compares a single field's actual value against its expected value.
func checkFieldValue(t *testing.T, key string, actual *string, expectedVal any) {
	t.Helper()

	switch want := expectedVal.(type) {
	case nil:
		if actual != nil {
			t.Errorf("%s = %q, want nil", key, *actual)
		}
	case string:
		if actual == nil {
			t.Errorf("%s = nil, want %q", key, want)
		} else if *actual != want {
			t.Errorf("%s = %q, want %q", key, *actual, want)
		}
	default:
		t.Errorf("%s: expected value must be string or nil, got %T", key, expectedVal)
	}
}

func runNormalizeTests(t *testing.T, tests []normalizeTestCase) {
	normalizer := setupTestNormalizer(t)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			response, err := normalizer.Match(t.Context(), tt.query)
			if err != nil {
				t.Fatalf("Normalize(%q) unexpected error: %v", tt.query.Address, err)
			}

			if response == nil {
				t.Fatal("Normalize() returned nil response")
			}

			if len(response.Features) == 0 {
				t.Fatal("Normalize() returned no results")
			}

			result := response.Features[0]

			if tt.wantMatchLevel != "" && result.MatchLevel != tt.wantMatchLevel {
				t.Errorf("match_level = %v, want %v", result.MatchLevel, tt.wantMatchLevel)
			}

			if tt.wantMatchedAddress != "" && result.MatchedAddress != tt.wantMatchedAddress {
				t.Errorf("matched_address = %v, want %v", result.MatchedAddress, tt.wantMatchedAddress)
			}

			checkUnmatchedAddress(t, result.UnmatchedAddress, tt.wantUnmatchedAddress)
			checkStructuredAddress(t, result.StructuredAddress, tt.wantStructured)
		})
	}
}

// checkUnmatchedAddress validates unmatched address parts.
// want behavior: nil = expect empty, []string{} = skip validation, []string{"..."} = expect values.
func checkUnmatchedAddress(t *testing.T, got []string, want []string) {
	t.Helper()

	switch {
	case want == nil:
		if len(got) > 0 {
			t.Errorf("unmatched_address = %v, want empty", got)
		}
	case len(want) == 0:
		// Skip validation
	case len(got) != len(want):
		t.Errorf("unmatched_address length = %d, want %d\n  got:  %v\n  want: %v",
			len(got), len(want), got, want)
	default:
		for i := range want {
			if got[i] != want[i] {
				t.Errorf("unmatched_address[%d] = %v, want %v", i, got[i], want[i])
			}
		}
	}
}
