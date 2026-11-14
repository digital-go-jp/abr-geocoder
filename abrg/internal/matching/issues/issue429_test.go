package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue429 covers a lot number written with 番地 and followed by a floor
// or room after a hyphen.
// The 番地 still becomes a hyphen, so the lot number is matched as when no
// floor follows.
// Issue #429: 番地の後ろにハイフンと階が続くと番地がハイフンに変わらない
// https://github.com/digital-go-jp/abr-geocoder/issues/429
func TestIssue429(t *testing.T) {
	query := func(address string) model.MatchQuery {
		return model.MatchQuery{
			Address:  address,
			Category: model.CategoryAll,
			Pref:     "all",
			Limit:    1,
		}
	}

	runNormalizeTests(t, []normalizeTestCase{
		{
			name:                 "issue429-1 [千葉県茂原市高師町２丁目１０番地４－２Ｆ] floor",
			query:                query("千葉県茂原市高師町２丁目１０番地４－２Ｆ"),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "千葉県茂原市高師町2丁目10-4",
			wantUnmatchedAddress: []string{"-2F"},
		},
		{
			name:                 "issue429-2 [埼玉県さいたま市岩槻区東岩槻１丁目９番地１５－１Ｆ] floor",
			query:                query("埼玉県さいたま市岩槻区東岩槻１丁目９番地１５－１Ｆ"),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "埼玉県さいたま市岩槻区東岩槻1丁目9-15",
			wantUnmatchedAddress: []string{"-1F"},
		},
		{
			name:                 "issue429-3 [千葉県茂原市高師町２丁目１０番地４] no floor",
			query:                query("千葉県茂原市高師町２丁目１０番地４"),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "千葉県茂原市高師町2丁目10-4",
			wantUnmatchedAddress: nil,
		},
	})
}
