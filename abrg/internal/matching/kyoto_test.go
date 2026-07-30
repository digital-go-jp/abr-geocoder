package matching

import (
	"testing"

	"abrg/internal/model"
)

func TestBuildSearchAddrWithoutKyotoSt(t *testing.T) {
	strPtr := func(s string) *string { return &s }

	tests := []struct {
		name       string
		sa         *model.StructuredAddress
		afterColon string
		want       string
	}{
		// Real data from DuckDB cache_machiaza (kyoto_st patterns)
		{
			name: "上長者町通千本東入愛染寺町",
			sa: &model.StructuredAddress{
				City:    strPtr("京都市"),
				Ward:    strPtr("上京区"),
				KyotoSt: strPtr("上長者町通千本東入"),
				OazaCho: strPtr("愛染寺町"),
			},
			afterColon: "123",
			want:       "京都市上京区愛染寺町:123",
		},
		{
			name: "大宮通元誓願寺下ル石薬師町",
			sa: &model.StructuredAddress{
				City:    strPtr("京都市"),
				Ward:    strPtr("上京区"),
				KyotoSt: strPtr("大宮通元誓願寺下る"),
				OazaCho: strPtr("石薬師町"),
			},
			afterColon: "",
			want:       "京都市上京区石薬師町",
		},
		{
			name: "七本松通中立売下る一番町",
			sa: &model.StructuredAddress{
				City:    strPtr("京都市"),
				Ward:    strPtr("上京区"),
				KyotoSt: strPtr("七本松通中立売下る"),
				OazaCho: strPtr("一番町"),
			},
			afterColon: "45",
			want:       "京都市上京区一番町:45",
		},
		{
			name: "大宮通丸太町上る一町目",
			sa: &model.StructuredAddress{
				City:    strPtr("京都市"),
				Ward:    strPtr("上京区"),
				KyotoSt: strPtr("大宮通丸太町上る"),
				OazaCho: strPtr("一町目"),
			},
			afterColon: "",
			want:       "京都市上京区一町目",
		},
		{
			name: "non-kyoto address",
			sa: &model.StructuredAddress{
				City:    strPtr("大阪市"),
				Ward:    strPtr("中央区"),
				OazaCho: strPtr("難波"),
				Chome:   strPtr("1丁目"),
			},
			afterColon: "1-1",
			want:       "大阪市中央区難波1丁目:1-1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := buildSearchAddrWithoutKyotoSt(tt.sa, tt.afterColon)
			if got != tt.want {
				t.Errorf("buildSearchAddrWithoutKyotoSt() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestMergeKyotoStToResults(t *testing.T) {
	strPtr := func(s string) *string { return &s }

	t.Run("merge kyoto_st from basic to parcel", func(t *testing.T) {
		basicResults := []model.MatchedResult{
			{
				StructuredAddress: model.StructuredAddress{
					City:    strPtr("京都市"),
					Ward:    strPtr("中京区"),
					KyotoSt: strPtr("寺町通御池上る"),
					OazaCho: strPtr("上本能寺前町"),
				},
				IDs: model.IDs{
					MachiazaID:  strPtr("0098104"),
					RsdtAddrFlg: strPtr("1"),
				},
			},
		}

		destResults := []model.MatchedResult{
			{
				StructuredAddress: model.StructuredAddress{
					City:    strPtr("京都市"),
					Ward:    strPtr("中京区"),
					OazaCho: strPtr("上本能寺前町"),
				},
				IDs: model.IDs{
					MachiazaID: strPtr("0098000"),
				},
			},
		}

		mergeKyotoStToResults(destResults, basicResults)

		if destResults[0].StructuredAddress.KyotoSt == nil {
			t.Error("KyotoSt should be merged")
		}
		if *destResults[0].StructuredAddress.KyotoSt != "寺町通御池上る" {
			t.Errorf("KyotoSt = %q, want %q", *destResults[0].StructuredAddress.KyotoSt, "寺町通御池上る")
		}
		if *destResults[0].IDs.MachiazaID != "0098104" {
			t.Errorf("MachiazaID = %q, want %q", *destResults[0].IDs.MachiazaID, "0098104")
		}
	})

	t.Run("no merge when basic has no kyoto_st", func(t *testing.T) {
		basicResults := []model.MatchedResult{
			{
				StructuredAddress: model.StructuredAddress{
					City:    strPtr("大阪市"),
					Ward:    strPtr("中央区"),
					OazaCho: strPtr("難波"),
				},
			},
		}

		destResults := []model.MatchedResult{
			{
				StructuredAddress: model.StructuredAddress{
					City:    strPtr("大阪市"),
					Ward:    strPtr("中央区"),
					OazaCho: strPtr("難波"),
				},
			},
		}

		mergeKyotoStToResults(destResults, basicResults)

		if destResults[0].StructuredAddress.KyotoSt != nil {
			t.Error("KyotoSt should remain nil")
		}
	})

	t.Run("no merge when basic results is empty", func(t *testing.T) {
		basicResults := []model.MatchedResult{}

		destResults := []model.MatchedResult{
			{
				StructuredAddress: model.StructuredAddress{
					City:    strPtr("京都市"),
					Ward:    strPtr("上京区"),
					OazaCho: strPtr("愛染寺町"),
				},
			},
		}

		mergeKyotoStToResults(destResults, basicResults)

		if destResults[0].StructuredAddress.KyotoSt != nil {
			t.Error("KyotoSt should remain nil")
		}
	})

	t.Run("no merge when dest results is empty", func(t *testing.T) {
		basicResults := []model.MatchedResult{
			{
				StructuredAddress: model.StructuredAddress{
					City:    strPtr("京都市"),
					Ward:    strPtr("上京区"),
					KyotoSt: strPtr("上長者町通千本東入"),
					OazaCho: strPtr("愛染寺町"),
				},
			},
		}

		destResults := []model.MatchedResult{}

		// Should not panic
		mergeKyotoStToResults(destResults, basicResults)

		if len(destResults) != 0 {
			t.Error("destResults should remain empty")
		}
	})

	t.Run("skip merge when dest already has kyoto_st", func(t *testing.T) {
		basicResults := []model.MatchedResult{
			{
				StructuredAddress: model.StructuredAddress{
					City:    strPtr("京都市"),
					Ward:    strPtr("上京区"),
					KyotoSt: strPtr("上長者町通千本東入"),
					OazaCho: strPtr("愛染寺町"),
				},
				IDs: model.IDs{
					MachiazaID: strPtr("0001001"),
				},
			},
		}

		destResults := []model.MatchedResult{
			{
				StructuredAddress: model.StructuredAddress{
					City:    strPtr("京都市"),
					Ward:    strPtr("上京区"),
					KyotoSt: strPtr("大宮通元誓願寺下る"), // already has different street
					OazaCho: strPtr("愛染寺町"),
				},
				IDs: model.IDs{
					MachiazaID: strPtr("0001002"),
				},
			},
		}

		mergeKyotoStToResults(destResults, basicResults)

		// Should keep original kyoto_st
		if *destResults[0].StructuredAddress.KyotoSt != "大宮通元誓願寺下る" {
			t.Errorf("KyotoSt = %q, want %q", *destResults[0].StructuredAddress.KyotoSt, "大宮通元誓願寺下る")
		}
		// Should keep original machiaza_id
		if *destResults[0].IDs.MachiazaID != "0001002" {
			t.Errorf("MachiazaID = %q, want %q", *destResults[0].IDs.MachiazaID, "0001002")
		}
	})
}
