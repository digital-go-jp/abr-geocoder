package issues

import (
	"context"
	"testing"

	"abrg/internal/model"
)

// TestIssue262 tests rsdt_addr_flg of residential matches in mixed areas
// Issue #262: 住居表示マッチの rsdt_addr_flg が基底町字の値になる（混在地域で 0 が返る）
// https://github.com/digital-go-jp/abr-geocoder/issues/262
//
// 問題:
// - 「千葉県浦安市舞浜2-11」(category=rsdtdsp) → rsdt_addr_flg="0"
// - マッチした町字（舞浜2丁目 0018002）の rsdt_addr_flg は 1。基底町字（0018000、
//   混在地域のため flg 0/1 の2行）からフラグをマージしているのが原因。
func TestIssue262(t *testing.T) {
	normalizer := setupTestNormalizer(t)

	tests := []struct {
		name     string
		query    model.MatchQuery
		wantFlg  string // "" = null を期待
		wantMcID string
	}{
		{
			name: "issue262-1 [千葉県浦安市舞浜2-11 rsdtdsp]",
			query: model.MatchQuery{
				Address:  "千葉県浦安市舞浜2-11",
				Category: model.CategoryResidential,
				Pref:     "all",
				Limit:    1,
			},
			wantFlg:  "1",
			wantMcID: "0018002",
		},
		{
			name: "issue262-2 [兵庫県三田市三輪2-1-1 all]",
			query: model.MatchQuery{
				Address:  "兵庫県三田市三輪2-1-1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantFlg:  "1",
			wantMcID: "0046002",
		},
	}

	tests = append(tests, []struct {
		name     string
		query    model.MatchQuery
		wantFlg  string
		wantMcID string
	}{
		{
			// 混在地域の町字マッチ: フラグが 0/1 の2行あるため不明 (null)。
			// v2 は AMBIGUOUS_RSDT_ADDR_FLG = -1 を返していた
			name: "issue262-3 [千葉県浦安市舞浜 (混在の基底町字)]",
			query: model.MatchQuery{
				Address:  "千葉県浦安市舞浜",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantFlg:  "",
			wantMcID: "0018000",
		},
		{
			// 丁目レベルでも混在があるケース
			name: "issue262-4 [北海道札幌市中央区南9条西5丁目]",
			query: model.MatchQuery{
				Address:  "北海道札幌市中央区南9条西5丁目",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantFlg:  "",
			wantMcID: "0074005",
		},
		{
			// 単一フラグの町字マッチは従来どおり値を返す
			name: "issue262-5 [東京都千代田区紀尾井町]",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀尾井町",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantFlg:  "1",
			wantMcID: "0056000",
		},
	}...)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			resp, err := normalizer.Match(context.Background(), tt.query)
			if err != nil {
				t.Fatalf("Match(%q) unexpected error: %v", tt.query.Address, err)
			}
			if len(resp.Features) == 0 {
				t.Fatal("Match() returned no results")
			}
			ids := resp.Features[0].IDs
			if ids.MachiazaID == nil || *ids.MachiazaID != tt.wantMcID {
				t.Errorf("machiaza_id = %v, want %q", ids.MachiazaID, tt.wantMcID)
			}
			if tt.wantFlg == "" {
				if ids.RsdtAddrFlg != nil {
					t.Errorf("rsdt_addr_flg = %q, want nil", *ids.RsdtAddrFlg)
				}
				return
			}
			if ids.RsdtAddrFlg == nil {
				t.Fatalf("rsdt_addr_flg = nil, want %q", tt.wantFlg)
			}
			if *ids.RsdtAddrFlg != tt.wantFlg {
				t.Errorf("rsdt_addr_flg = %q, want %q", *ids.RsdtAddrFlg, tt.wantFlg)
			}
		})
	}
}
