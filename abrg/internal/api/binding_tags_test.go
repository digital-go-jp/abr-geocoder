package api

import (
	"reflect"
	"slices"
	"strconv"
	"strings"
	"testing"

	"abrg/internal/model"
	"abrg/internal/validate"
)

// bindingTag returns the binding tag of a baseRequest field.
func bindingTag(t *testing.T, field string) string {
	t.Helper()
	f, ok := reflect.TypeOf(baseRequest{}).FieldByName(field)
	if !ok {
		t.Fatalf("baseRequest has no field %s", field)
	}
	return f.Tag.Get("binding")
}

// rule returns the value of a "name=value" rule inside a binding tag.
func rule(t *testing.T, tag, name string) string {
	t.Helper()
	for _, part := range strings.Split(tag, ",") {
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
