package api

import (
	"reflect"
	"slices"
	"strconv"
	"strings"
	"testing"

	"abrg/internal/model"
	"abrg/internal/util"
	"abrg/internal/validate"
)

// bindingTag returns the binding tag of a baseRequest field.
func bindingTag(t *testing.T, field string) string {
	t.Helper()
	f, ok := reflect.TypeFor[baseRequest]().FieldByName(field)
	if !ok {
		t.Fatalf("baseRequest has no field %s", field)
	}
	return f.Tag.Get("binding")
}

// reverseBindingTag returns the binding tag of a reverseRequest field.
func reverseBindingTag(t *testing.T, field string) string {
	t.Helper()
	f, ok := reflect.TypeFor[reverseRequest]().FieldByName(field)
	if !ok {
		t.Fatalf("reverseRequest has no field %s", field)
	}
	return f.Tag.Get("binding")
}

// rule returns the value of a "name=value" rule inside a binding tag.
func rule(t *testing.T, tag, name string) string {
	t.Helper()
	for part := range strings.SplitSeq(tag, ",") {
		if v, ok := strings.CutPrefix(part, name+"="); ok {
			return v
		}
	}
	t.Fatalf("binding tag %q has no %s rule", tag, name)
	return ""
}

// Binding tags must be literals, so they restate model.Categories and
// validate.MinLimit/MaxLimit. These tests fail when the two drift apart.
func TestCategoryBindingTagMatchesModel(t *testing.T) {
	got := strings.Fields(rule(t, bindingTag(t, "Category"), "oneof"))

	want := make([]string, len(model.Categories))
	for i, c := range model.Categories {
		want[i] = string(c)
	}
	if !slices.Equal(got, want) {
		t.Errorf("oneof = %v, want %v (model.Categories)", got, want)
	}
}

func TestLimitBindingTagMatchesValidate(t *testing.T) {
	tag := bindingTag(t, "Limit")
	if got, want := rule(t, tag, "min"), strconv.Itoa(validate.MinLimit); got != want {
		t.Errorf("min = %s, want %s (validate.MinLimit)", got, want)
	}
	if got, want := rule(t, tag, "max"), strconv.Itoa(validate.MaxLimit); got != want {
		t.Errorf("max = %s, want %s (validate.MaxLimit)", got, want)
	}
}

func TestLatBindingTagMatchesCoordinates(t *testing.T) {
	tag := reverseBindingTag(t, "Lat")
	if got, want := rule(t, tag, "min"), strconv.Itoa(util.MinLat); got != want {
		t.Errorf("min = %s, want %s (util.MinLat)", got, want)
	}
	if got, want := rule(t, tag, "max"), strconv.Itoa(util.MaxLat); got != want {
		t.Errorf("max = %s, want %s (util.MaxLat)", got, want)
	}
}

func TestLonBindingTagMatchesCoordinates(t *testing.T) {
	tag := reverseBindingTag(t, "Lon")
	if got, want := rule(t, tag, "min"), strconv.Itoa(util.MinLon); got != want {
		t.Errorf("min = %s, want %s (util.MinLon)", got, want)
	}
	if got, want := rule(t, tag, "max"), strconv.Itoa(util.MaxLon); got != want {
		t.Errorf("max = %s, want %s (util.MaxLon)", got, want)
	}
}
