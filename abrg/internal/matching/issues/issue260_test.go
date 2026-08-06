package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue260 tests separator insertion between digit-ending and digit-starting parts
// Issue #260: 数字で終わる要素と数字で始まる要素が区切りなしで連結される
// https://github.com/digital-go-jp/abr-geocoder/issues/260
//
// 問題:
// - 「七尾市大田町111-11」（小字111 + 地番11）→ matched_address が「大田町11111」になる
//
// FormatAddress は要素を順に連結するだけで、数字終わり×数字始まりの境界に
// 区切りが入らない。直前の文字が ASCII 数字で次の要素も数字で始まる場合は
// 「-」を挿入する。
func TestIssue260(t *testing.T) {
	strPtr := func(s string) *string { return &s }

	tests := []struct {
		name string
		sa   model.StructuredAddress
		want string
	}{
		// 数字小字 + 地番（issue 報告の具体例）
		{
			name: "issue260-1 [大田町111 + 地番11]",
			sa: model.StructuredAddress{
				Pref: strPtr("石川県"), City: strPtr("七尾市"),
				OazaCho: strPtr("大田町"), Koaza: strPtr("111"),
				PrcNum1: strPtr("11"),
			},
			want: "石川県七尾市大田町111-11",
		},
		// 数字小字 + 街区・住居番号
		{
			name: "issue260-2 [大田町111 + 街区2 住居5]",
			sa: model.StructuredAddress{
				Pref: strPtr("石川県"), City: strPtr("七尾市"),
				OazaCho: strPtr("大田町"), Koaza: strPtr("111"),
				BlkNum: strPtr("2"), RsdtNum: strPtr("5"),
			},
			want: "石川県七尾市大田町111-2-5",
		},
		// 漢数字小字は数字で終わらないので区切り不要
		{
			name: "issue260-3 [大田町壱壱壱 + 地番11] 区切りなし",
			sa: model.StructuredAddress{
				Pref: strPtr("石川県"), City: strPtr("七尾市"),
				OazaCho: strPtr("大田町"), Koaza: strPtr("壱壱壱"),
				PrcNum1: strPtr("11"),
			},
			want: "石川県七尾市大田町壱壱壱11",
		},
		// 小字が数字以外で終わる場合も区切り不要
		{
			name: "issue260-4 [大聖寺上木町95の + 地番7] 区切りなし",
			sa: model.StructuredAddress{
				Pref: strPtr("石川県"), City: strPtr("加賀市"),
				OazaCho: strPtr("大聖寺上木町"), Koaza: strPtr("95の"),
				PrcNum1: strPtr("7"),
			},
			want: "石川県加賀市大聖寺上木町95の7",
		},
		// 既存の区切り（街区-住居、地番間）は二重にならない
		{
			name: "issue260-5 [紀尾井町1-3] 回帰",
			sa: model.StructuredAddress{
				Pref: strPtr("東京都"), City: strPtr("千代田区"),
				OazaCho: strPtr("紀尾井町"), BlkNum: strPtr("1"),
				RsdtNum: strPtr("3"),
			},
			want: "東京都千代田区紀尾井町1-3",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := model.FormatAddress(&tt.sa)
			if got != tt.want {
				t.Errorf("FormatAddress() = %q, want %q", got, tt.want)
			}
		})
	}
}

// TestIssue260EndToEnd verifies the matched_address via the full matching path.
func TestIssue260EndToEnd(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue260-e2e [七尾市大田町111-11]",
			query: model.MatchQuery{
				Address:  "七尾市大田町111-11",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "石川県七尾市大田町111-11",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "石川県",
				FieldCity:    "七尾市",
				FieldOazaCho: "大田町",
				FieldKoaza:   "111",
				FieldPrcNum1: "11",
			},
		},
	})
}
