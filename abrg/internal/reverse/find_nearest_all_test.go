package reverse

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/repository"
)

// fakeQuerier returns fixed rows or errors for each reverse table.
type fakeQuerier struct {
	basic                               []repository.ReverseBaseFields
	basicErr, residentialErr, parcelErr error
}

func (f fakeQuerier) FindNearestBasic(context.Context, repository.SpatialParams) ([]repository.ReverseBaseFields, error) {
	return f.basic, f.basicErr
}

func (f fakeQuerier) FindNearestResidential(context.Context, repository.SpatialParams) ([]repository.ReverseResidentialResult, error) {
	return nil, f.residentialErr
}

func (f fakeQuerier) FindNearestParcel(context.Context, repository.SpatialParams) ([]repository.ReverseParcelResult, error) {
	return nil, f.parcelErr
}

func TestFindNearestAll_QueryFailure(t *testing.T) {
	errQuery := errors.New("query failed")
	row := repository.ReverseBaseFields{Pref: "東京都", City: "千代田区", LgCode: "131016", MachiazaID: "0056000", Lon: 139.73495, Lat: 35.68141}
	params := repository.SpatialParams{Lon: 139.7364, Lat: 35.6791, Limit: 5, Radius: searchRadius}

	tests := []struct {
		name         string
		repo         fakeQuerier
		wantFeatures int
		wantErr      bool
	}{
		{name: "failed query is skipped when another has results", repo: fakeQuerier{basic: []repository.ReverseBaseFields{row}, parcelErr: errQuery}, wantFeatures: 1},
		{name: "failed query with no results is an error", repo: fakeQuerier{parcelErr: errQuery}, wantErr: true},
		{name: "no results without a failure is not an error", repo: fakeQuerier{}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			g := NewReverseGeocoder(tt.repo, true, true)
			features, err := g.findNearestAll(t.Context(), params)
			if tt.wantErr {
				if !errors.Is(err, errQuery) {
					t.Fatalf("error = %v, want it to wrap %v", err, errQuery)
				}
				if !strings.HasPrefix(err.Error(), "no reverse geocoding results; a query failed") {
					t.Errorf("error = %q, want it to say no results were found and a query failed", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(features) != tt.wantFeatures {
				t.Errorf("got %d features, want %d", len(features), tt.wantFeatures)
			}
		})
	}
}
