package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue450 covers same-named machiaza that both hold the whole input lot.
// lg_code=032158 has 水沢字袋町 (machiaza_id=0198215, holds parcel 1-1)
// and 水沢袋町 (machiaza_id=0198265, holds block 1 with no residential numbers recorded).
// lg_code=403814 has 大字山鹿 (machiaza_id=0003000, holds parcel 35-15)
// and 山鹿 (machiaza_id=0015000, holds residential number 35-15).
// lg_code=242055 has 大字萱町 (machiaza_id=0028000) and 萱町 (machiaza_id=0074000),
// both holding parcel 35.
// The spelling with 大字 and 字 decides among them.
// Issue #450: 同名の町字の両方に入力の番号の全体が所属すると、入力の形式と表記に合わない町字を選択する
// https://github.com/digital-go-jp/abr-geocoder/issues/450
func TestIssue450(t *testing.T) {
	query := func(address string) model.MatchQuery {
		return model.MatchQuery{Address: address, Category: model.CategoryAll, Pref: "all", Limit: 1}
	}

	runNormalizeTests(t, []normalizeTestCase{
		{
			name:                 "issue450-1 [岩手県奥州市水沢字袋町１番地１] all",
			query:                query("岩手県奥州市水沢字袋町１番地１"),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "岩手県奥州市水沢字袋町1-1",
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldOazaCho: "水沢", FieldKoaza: "字袋町", FieldPrcNum1: "1", FieldPrcNum2: "1"},
		},
		{
			name:                 "issue450-2 [福岡県遠賀郡芦屋町山鹿３５番１５号] all",
			query:                query("福岡県遠賀郡芦屋町山鹿３５番１５号"),
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "福岡県遠賀郡芦屋町山鹿35-15",
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldOazaCho: "山鹿", FieldBlkNum: "35", FieldRsdtNum: "15"},
		},
		{
			name:                 "issue450-3 [三重県桑名市萱町３５番地] all",
			query:                query("三重県桑名市萱町３５番地"),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "三重県桑名市萱町35",
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldOazaCho: "萱町", FieldPrcNum1: "35"},
		},
		{
			name:                 "issue450-4 [三重県桑名市大字萱町３５番地] all",
			query:                query("三重県桑名市大字萱町３５番地"),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "三重県桑名市大字萱町35",
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldOazaCho: "大字萱町", FieldPrcNum1: "35"},
		},
	})
}
