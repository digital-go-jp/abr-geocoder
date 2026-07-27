package reverse

import (
	"context"
	"errors"
	"sync"
	"testing"

	"abrg/internal/cache"
	"abrg/internal/model"
	"abrg/internal/repository"
)

// The tests in this file use the committed quickstart cache (Tokyo, basic
// category) to pin the behavior of a cache built without category data:
// opening it succeeds and residential/parcel reverse queries fail with
// ErrDataUnavailable instead of returning an empty success.
var initBasicCacheGeocoder = sync.OnceValues(func() (*ReverseGeocoder, error) {
	ctx := context.Background()
	c, err := cache.NewDuckDBCacheFromPath(ctx, "../../../quickstart/tokyo_basic.duckdb")
	if err != nil {
		return nil, err
	}
	cfg, err := cache.LoadConfig(ctx, c.DB())
	if err != nil {
		return nil, err
	}
	return NewReverseGeocoder(repository.NewRepository(c.DB()), cfg.HasResidential(), cfg.HasParcel()), nil
})

// setupBasicCacheGeocoder opens the quickstart cache. The file is tracked in
// Git, so a failure to open it is a real regression and fails the test
// instead of skipping.
func setupBasicCacheGeocoder(t *testing.T) *ReverseGeocoder {
	t.Helper()
	g, err := initBasicCacheGeocoder()
	if err != nil {
		t.Fatalf("open quickstart cache: %v", err)
	}
	return g
}

func TestReverse_BasicCache(t *testing.T) {
	geocoder := setupBasicCacheGeocoder(t)

	query := func(category model.Category) model.ReverseQuery {
		// Kioicho, Chiyoda-ku in the quickstart cache.
		return model.ReverseQuery{Lon: 139.734955, Lat: 35.681412, Category: category, Pref: "all", Limit: 1}
	}

	t.Run("basic category works", func(t *testing.T) {
		resp, err := geocoder.Reverse(t.Context(), query(model.CategoryBasic))
		if err != nil {
			t.Fatalf("Reverse(basic) error = %v", err)
		}
		if len(resp.Features) == 0 {
			t.Fatal("Reverse(basic) returned no features")
		}
	})

	for _, category := range []model.Category{model.CategoryResidential, model.CategoryParcel} {
		t.Run("category "+string(category)+" is unavailable", func(t *testing.T) {
			_, err := geocoder.Reverse(t.Context(), query(category))
			if !errors.Is(err, ErrDataUnavailable) {
				t.Fatalf("Reverse(%s) error = %v, want ErrDataUnavailable", category, err)
			}
		})
	}
}
