package matching_test

import (
	"context"
	"errors"
	"sync"
	"testing"

	"abrg/internal/cache"
	"abrg/internal/matching"
	"abrg/internal/model"
	"abrg/internal/repository"
)

// The tests in this file use the committed quickstart cache (Tokyo, basic
// category) to pin that a matcher built for a cache without category data
// answers residential/parcel/all queries with ErrDataUnavailable instead of
// querying missing tables, while basic matching keeps working.
var initBasicCacheMatcher = sync.OnceValues(func() (matching.Matcher, error) {
	ctx := context.Background()
	c, err := cache.NewDuckDBCacheFromPath(ctx, "../../../quickstart/tokyo_basic.duckdb")
	if err != nil {
		return nil, err
	}
	cfg, err := cache.LoadConfig(ctx, c.DB())
	if err != nil {
		return nil, err
	}
	return matching.NewMatcher(repository.NewRepository(c.DB()), c.Lookups(), cfg.HasResidential(), cfg.HasParcel()), nil
})

func TestMatch_BasicCache(t *testing.T) {
	matcher, err := initBasicCacheMatcher()
	if err != nil {
		t.Fatalf("open quickstart cache: %v", err)
	}

	query := func(category model.Category) model.MatchQuery {
		return model.MatchQuery{Address: "東京都千代田区紀尾井町1-3", Category: category, Limit: 1}
	}

	t.Run("basic category works", func(t *testing.T) {
		resp, err := matcher.Match(t.Context(), query(model.CategoryBasic))
		if err != nil {
			t.Fatalf("Match(basic) error = %v", err)
		}
		if len(resp.Features) == 0 {
			t.Fatal("Match(basic) returned no features")
		}
	})

	for _, category := range []model.Category{model.CategoryResidential, model.CategoryParcel, model.CategoryAll} {
		t.Run("category "+string(category)+" is unavailable", func(t *testing.T) {
			_, err := matcher.Match(t.Context(), query(category))
			if !errors.Is(err, matching.ErrDataUnavailable) {
				t.Fatalf("Match(%s) error = %v, want ErrDataUnavailable", category, err)
			}
		})
	}
}
