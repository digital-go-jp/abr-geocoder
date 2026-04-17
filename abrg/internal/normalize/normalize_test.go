package normalize

import (
	"testing"

	"abrg/internal/model"
)

func TestNormalizeAddressText(t *testing.T) {
	tests := []struct {
		name         string
		input        string
		expectedAddr string
		expectedType model.NormalizeCategory
	}{
		// Comment removal tests
		{
			name:         "block comment removal",
			input:        "東京都千代田区/* comment */紀尾井町1番3号",
			expectedAddr: "東京都千代田区紀尾井町1-3",
			expectedType: model.NormalizeCategoryResidential,
		},
		{
			name:         "line comment removal",
			input:        "東京都千代田区紀尾井町1番3号 // comment",
			expectedAddr: "東京都千代田区紀尾井町1-3",
			expectedType: model.NormalizeCategoryResidential,
		},

		// NFKC normalization tests
		{
			name:         "full-width to half-width conversion",
			input:        "東京都千代田区紀尾井町１番３号",
			expectedAddr: "東京都千代田区紀尾井町1-3",
			expectedType: model.NormalizeCategoryResidential,
		},
		{
			name:         "full-width dash normalization",
			input:        "東京都千代田区紀尾井町１－２－３",
			expectedAddr: "東京都千代田区紀尾井町1-2-3",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "katakana prolonged sound mark between numbers",
			input:        "東京都千代田区紀尾井町1ー2ー3",
			expectedAddr: "東京都千代田区紀尾井町1-2-3",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "half-width katakana conversion",
			input:        "東京都千代田区紀尾井町1番3号東京ｶﾞｰﾃﾞﾝﾃﾗｽ紀尾井町",
			expectedAddr: "東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町",
			expectedType: model.NormalizeCategoryResidential,
		},

		// Space normalization tests
		{
			name:         "multiple spaces normalization",
			input:        "東京都　　千代田区　　紀尾井町　　1番3号",
			expectedAddr: "東京都 千代田区 紀尾井町 1-3",
			expectedType: model.NormalizeCategoryUnknown, // Space splits the address, so first part has no number pattern
		},
		{
			name:         "tab normalization",
			input:        "東京都\t千代田区\t紀尾井町\t1番3号",
			expectedAddr: "東京都 千代田区 紀尾井町 1-3",
			expectedType: model.NormalizeCategoryUnknown, // Tab (converted to space) splits the address, so first part has no number pattern
		},

		// Address type detection tests
		{
			name:         "residential pattern (番号)",
			input:        "東京都千代田区1番3号",
			expectedAddr: "東京都千代田区1-3",
			expectedType: model.NormalizeCategoryResidential,
		},
		{
			name:         "residential pattern with alphanumeric suffix",
			input:        "東京都文京区春日二丁目２２番５－Ａ１００２号",
			expectedAddr: "東京都文京区春日二丁目22-5 -A1002",
			expectedType: model.NormalizeCategoryResidential,
		},
		{
			name:         "residential pattern with hyphen (番-号)",
			input:        "東京都千代田区1番2-3号",
			expectedAddr: "東京都千代田区1-2-3",
			expectedType: model.NormalizeCategoryResidential,
		},
		{
			name:         "ban pattern without go",
			input:        "東京都千代田区1番3",
			expectedAddr: "東京都千代田区1-3",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "ban pattern at end of string",
			input:        "熊本県菊池郡西合志町御代志字井手向１００１番１１",
			expectedAddr: "熊本県菊池郡西合志町御代志字井手向1001-11",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "parcel pattern (番地)",
			input:        "東京都世田谷区1番地",
			expectedAddr: "東京都世田谷区1",
			expectedType: model.NormalizeCategoryParcel,
		},
		{
			name:         "parcel pattern (番地の)",
			input:        "東京都世田谷区1番地の2",
			expectedAddr: "東京都世田谷区1-2",
			expectedType: model.NormalizeCategoryParcel,
		},
		{
			name:         "parcel pattern (番地N)",
			input:        "東京都世田谷区1番地2",
			expectedAddr: "東京都世田谷区1-2",
			expectedType: model.NormalizeCategoryParcel,
		},
		{
			name:         "undetermined pattern (arabic dash)",
			input:        "東京都千代田区1-2-3",
			expectedAddr: "東京都千代田区1-2-3",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "undetermined pattern with building - add space",
			input:        "東京都千代田区紀尾井町1-2-3東京ガーデンテラス",
			expectedAddr: "東京都千代田区紀尾井町1-2-3 東京ガーデンテラス",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "undetermined pattern (incorrect banchi-go)",
			input:        "東京都千代田区1番地2号",
			expectedAddr: "東京都千代田区1-2",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "unknown pattern (prefecture only)",
			input:        "東京都",
			expectedAddr: "東京都",
			expectedType: model.NormalizeCategoryUnknown,
		},

		// Complex cases
		{
			name:         "full processing with all transformations",
			input:        "東京都/* comment */　　千代田区　　紀尾井町１番３号　　東京ガーデンテラス",
			expectedAddr: "東京都 千代田区 紀尾井町1-3 東京ガーデンテラス",
			expectedType: model.NormalizeCategoryUnknown, // After comment removal, space splits the address, so first part has no number pattern
		},
		{
			name:         "address with building name",
			input:        "東京都千代田区紀尾井町1番3号東京ガーデンテラス",
			expectedAddr: "東京都千代田区紀尾井町1-3 東京ガーデンテラス",
			expectedType: model.NormalizeCategoryResidential,
		},
		{
			name:         "trailing spaces after conversion",
			input:        "東京都新宿区1番地",
			expectedAddr: "東京都新宿区1",
			expectedType: model.NormalizeCategoryParcel,
		},

		// Edge cases
		{
			name:         "empty string",
			input:        "",
			expectedAddr: "",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "only spaces",
			input:        "   　　　   ",
			expectedAddr: "",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "only comment",
			input:        "/* comment */",
			expectedAddr: "",
			expectedType: model.NormalizeCategoryUnknown,
		},

		// Real-world cases
		{
			name:         "real case - saitama yoshikawa",
			input:        "埼玉県吉川市旭９番１",
			expectedAddr: "埼玉県吉川市旭9-1",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "real case - saitama ageo",
			input:        "埼玉県上尾市西宮下二丁目１５５番３",
			expectedAddr: "埼玉県上尾市西宮下二丁目155-3",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "real case - N番 only",
			input:        "埼玉県川崎市幸区大宮町１３１０番",
			expectedAddr: "埼玉県川崎市幸区大宮町1310",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "real case - 2393番2",
			input:        "群馬県利根郡新治村大字入須川２３９３番２",
			expectedAddr: "群馬県利根郡新治村大字入須川2393-2",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "real case - 1番7",
			input:        "広島県大竹市明治新開１番７",
			expectedAddr: "広島県大竹市明治新開1-7",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "real case - 3番 only",
			input:        "宮崎市矢の先町３番",
			expectedAddr: "宮崎市矢の先町3",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "real case - 555番1",
			input:        "宮城県名取市上余田字千刈田５５５番１",
			expectedAddr: "宮城県名取市上余田字千刈田555-1",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "with carriage return",
			input:        "宮城県名取市上余田字千刈田５５５番１\r",
			expectedAddr: "宮城県名取市上余田字千刈田555-1",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "with newline",
			input:        "宮崎市矢の先町３番\n",
			expectedAddr: "宮崎市矢の先町3",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "hyphenated address with building name - イーストコート",
			input:        "神戸市東灘区向洋町中1-14イーストコート2番街",
			expectedAddr: "神戸市東灘区向洋町中1-14 イーストコート2番街",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "address with parentheses",
			input:        "東京都港区(六本木)",
			expectedAddr: "東京都港区 (六本木)",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "address with comma",
			input:        "東京都港区,六本木1-2-3",
			expectedAddr: "東京都港区 ,六本木1-2-3",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "address with Japanese comma",
			input:        "東京都港区、六本木1-2-3",
			expectedAddr: "東京都港区 、六本木1-2-3",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "address with mixed punctuation",
			input:        "神戸市東灘区向洋町中1-14(イーストコート2番街)",
			expectedAddr: "神戸市東灘区向洋町中1-14 (イーストコート2番街)",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "ban with building and go",
			input:        "横浜市金沢区釜利谷南一丁目３番Ｄ−４１７号",
			expectedAddr: "横浜市金沢区釜利谷南一丁目3 D-417号",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "ban with japanese text and go",
			input:        "横浜市青葉区あざみ野三丁目１番あざみ野団地４棟１０４号",
			expectedAddr: "横浜市青葉区あざみ野三丁目1 あざみ野団地4棟104号",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "ban with building name",
			input:        "横浜市中区海岸通二丁目８番第二吉本ビル４階",
			expectedAddr: "横浜市中区海岸通二丁目8 第二吉本ビル4階",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "chome ban pattern",
			input:        "横浜市中区桜木町二丁目２番港陽ビル７階",
			expectedAddr: "横浜市中区桜木町二丁目2 港陽ビル7階",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "real case - with fullwidth hyphen",
			input:        "埼玉県吉川市旭９－１",
			expectedAddr: "埼玉県吉川市旭9-1",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "real case - with various dashes",
			input:        "埼玉県上尾市西宮下二丁目１５５－３－４",
			expectedAddr: "埼玉県上尾市西宮下二丁目155-3-4",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "ban tou pattern with full-width",
			input:        "千葉県船橋市行田三丁目１番１２棟２０６号",
			expectedAddr: "千葉県船橋市行田三丁目1 12棟206号",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "ban tou pattern",
			input:        "千葉県船橋市習志野台六丁目8番4棟304号",
			expectedAddr: "千葉県船橋市習志野台六丁目8 4棟304号",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "ban no pattern",
			input:        "愛知県小牧市大字河内屋新田字下岩倉杁510番の1",
			expectedAddr: "愛知県小牧市大字河内屋新田字下岩倉杁510-1",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "ban gai pattern with full-width",
			input:        "東京都港区台場一丁目５番街１号棟６０１号室",
			expectedAddr: "東京都港区台場一丁目5番街 1号棟601号室",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "ban building pattern",
			input:        "神戸市中央区京町８０番クリエイト神戸９階",
			expectedAddr: "神戸市中央区京町80 クリエイト神戸9階",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "ban building pattern with same number",
			input:        "神戸市中央区江戸町１０４番江戸町１０４ビル４階",
			expectedAddr: "神戸市中央区江戸町104 江戸町104ビル4階",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "ban no with additional no pattern",
			input:        "東京都千代田区西神田二丁目６番７の２共和１５番館ビル２階",
			expectedAddr: "東京都千代田区西神田二丁目6-7-2 共和15番館ビル2階",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "banchi go tou pattern",
			input:        "埼玉県三郷市早稲田六丁目１番地２号棟２０１号",
			expectedAddr: "埼玉県三郷市早稲田六丁目1 2号棟201号",
			expectedType: model.NormalizeCategoryUndetermined,
		},
		{
			name:         "address with parentheses",
			input:        "東京都千代田区１番３号(東京ガーデンテラス)",
			expectedAddr: "東京都千代田区1-3 (東京ガーデンテラス)",
			expectedType: model.NormalizeCategoryResidential,
		},
		{
			name:         "address with parentheses and building",
			input:        "東京都千代田区一番町５(アトラスビル５階)",
			expectedAddr: "東京都千代田区一番町5 (アトラスビル5階)",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "banchi pattern with machi",
			input:        "新潟県新潟市東中通１番町１８８番地２",
			expectedAddr: "新潟県新潟市東中通1番町188-2",
			expectedType: model.NormalizeCategoryParcel,
		},
		{
			name:         "ichibancho with ban go building",
			input:        "東京都千代田区一番町９番８号ノザワビル６Ｆ",
			expectedAddr: "東京都千代田区一番町9-8 ノザワビル6F",
			expectedType: model.NormalizeCategoryResidential,
		},
		{
			name:         "number followed by building name",
			input:        "茨城県つくば市島名２３３５ウィンズヒル４Ｂ",
			expectedAddr: "茨城県つくば市島名2335 ウィンズヒル4B",
			expectedType: model.NormalizeCategoryUnknown,
		},
		{
			name:         "room number with dash-hyphen",
			input:        "東京都千代田区三崎町三丁目２番６−１１０４号室レジディア水道橋",
			expectedAddr: "東京都千代田区三崎町三丁目2-6 -1104号室レジディア水道橋",
			expectedType: model.NormalizeCategoryResidential,
		},
		{
			name:         "ichibancho with hyphen and building",
			input:        "東京都千代田区一番町4-4THECROSS一番町7階",
			expectedAddr: "東京都千代田区一番町4-4 THECROSS一番町7階",
			expectedType: model.NormalizeCategoryUndetermined,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, addressType := NormalizeAddressText(tt.input)

			if result != tt.expectedAddr {
				t.Errorf("NormalizeAddressText(%q) address = %q, want %q", tt.input, result, tt.expectedAddr)
			}

			if addressType != tt.expectedType {
				t.Errorf("NormalizeAddressText(%q) type = %q, want %q", tt.input, addressType, tt.expectedType)
			}
		})
	}
}

// TestNormalizeAddressTextWithBasic tests the NormalizeAddressTextWithBasic function
func TestNormalizeAddressTextWithBasic(t *testing.T) {
	tests := []struct {
		name           string
		input          string
		expectedAddr   string
		expectedType   model.NormalizeCategory
		usePreComputed bool // Whether to test with pre-computed BasicNormalize result
	}{
		{
			name:           "nil basicResult - same as NormalizeAddressText",
			input:          "東京都千代田区紀尾井町1番3号",
			expectedAddr:   "東京都千代田区紀尾井町1-3",
			expectedType:   model.NormalizeCategoryResidential,
			usePreComputed: false,
		},
		{
			name:           "with pre-computed basicResult",
			input:          "東京都千代田区紀尾井町1番3号",
			expectedAddr:   "東京都千代田区紀尾井町1-3",
			expectedType:   model.NormalizeCategoryResidential,
			usePreComputed: true,
		},
		{
			name:           "with NFKC conversion",
			input:          "東京都千代田区紀尾井町１番３号",
			expectedAddr:   "東京都千代田区紀尾井町1-3",
			expectedType:   model.NormalizeCategoryResidential,
			usePreComputed: true,
		},
		{
			name:           "with dash normalization",
			input:          "東京都千代田区紀尾井町1—2—3", // em-dash
			expectedAddr:   "東京都千代田区紀尾井町1-2-3",
			expectedType:   model.NormalizeCategoryUndetermined,
			usePreComputed: true,
		},
		{
			name:           "with building name",
			input:          "兵庫県三田市三輪2-1-1三田市役所",
			expectedAddr:   "兵庫県三田市三輪2-1-1 三田市役所",
			expectedType:   model.NormalizeCategoryUndetermined,
			usePreComputed: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var result string
			var addressType model.NormalizeCategory

			if tt.usePreComputed {
				basicResult := BasicNormalize(tt.input)
				result, addressType = NormalizeAddressTextWithBasic(tt.input, &basicResult)
			} else {
				result, addressType = NormalizeAddressTextWithBasic(tt.input, nil)
			}

			if result != tt.expectedAddr {
				t.Errorf("NormalizeAddressTextWithBasic(%q) address = %q, want %q", tt.input, result, tt.expectedAddr)
			}

			if addressType != tt.expectedType {
				t.Errorf("NormalizeAddressTextWithBasic(%q) type = %q, want %q", tt.input, addressType, tt.expectedType)
			}

			// Also verify that with nil and with precomputed give the same result
			nilResult, nilType := NormalizeAddressTextWithBasic(tt.input, nil)
			normalized := BasicNormalize(tt.input)
			preResult, preType := NormalizeAddressTextWithBasic(tt.input, &normalized)

			if nilResult != preResult {
				t.Errorf("Results differ: nil=%q, precomputed=%q", nilResult, preResult)
			}
			if nilType != preType {
				t.Errorf("Types differ: nil=%q, precomputed=%q", nilType, preType)
			}
		})
	}
}

func BenchmarkNormalizeAddressText(b *testing.B) {
	testCases := []string{
		"東京都新宿区1番2号",
		"東京都/* comment */新宿区１番２号",
		"東京都　　新宿区　　1番地の2",
		"東京都千代田区1-2-3",
		"東京都世田谷区1番地",
	}

	for _, tc := range testCases {
		b.Run("input_"+tc[:min(20, len(tc))], func(b *testing.B) {
			for b.Loop() {
				NormalizeAddressText(tc)
			}
		})
	}
}
