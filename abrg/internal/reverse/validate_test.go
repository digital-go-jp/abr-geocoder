package reverse

import (
	"errors"
	"math"
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/util"
)

func TestReverseRejectsInvalidCoordinates(t *testing.T) {
	g := &ReverseGeocoder{}
	_, err := g.Reverse(t.Context(), model.ReverseQuery{Lon: math.NaN(), Lat: math.NaN(), Category: model.CategoryBasic})
	if !errors.Is(err, util.ErrInvalidCoordinates) {
		t.Errorf("Reverse(NaN, NaN) error = %v, want it to match util.ErrInvalidCoordinates", err)
	}
}
