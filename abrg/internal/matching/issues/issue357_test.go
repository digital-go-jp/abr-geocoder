package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue357 covers a machiaza registered twice, with and without 大字,
// where only one of the two holds the parcels.
// lg_code=122203 has 中野久木 (machiaza_id=0069000) with parcels and
// 大字中野久木 (machiaza_id=0017000) without them.
// Writing 大字 does not change which of the two is chosen.
// Issue #357: 同じ町字が2つの machiaza_id で登録され、地番が片方にしか付いていない
// https://github.com/digital-go-jp/abr-geocoder/issues/357
func TestIssue357(t *testing.T) {
	query := func(address string, category model.Category) model.MatchQuery {
		return model.MatchQuery{
			Address:  address,
			Category: category,
			Pref:     "all",
			Limit:    1,
		}
	}

	runNormalizeTests(t, []normalizeTestCase{
		{
			name:                 "issue357-1 [千葉県流山市大字中野久木559番地2] all",
			query:                query("千葉県流山市大字中野久木559番地2", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "千葉県流山市中野久木559-2",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldOazaCho: "中野久木",
				FieldPrcNum1: "559",
				FieldPrcNum2: "2",
			},
		},
		{
			name:                 "issue357-2 [千葉県流山市大字中野久木559番地2] basic",
			query:                query("千葉県流山市大字中野久木559番地2", model.CategoryBasic),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "千葉県流山市中野久木",
			wantUnmatchedAddress: []string{"559-2"},
			wantStructured:       map[string]any{FieldOazaCho: "中野久木"},
		},
		{
			name:               "issue357-3 [千葉県流山市大字中野久木] all",
			query:              query("千葉県流山市大字中野久木", model.CategoryAll),
			wantMatchLevel:     model.MatchLevelMachiaza,
			wantMatchedAddress: "千葉県流山市中野久木",
			wantStructured:     map[string]any{FieldOazaCho: "中野久木"},
		},
	})
}
