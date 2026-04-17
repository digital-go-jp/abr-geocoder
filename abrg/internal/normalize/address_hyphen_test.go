package normalize

import "testing"

func TestAddressNumbersToHyphen(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		// banchi/ - 番地パターン
		{
			name:     "banchi/N番地N号_基本",
			input:    "1番地2号",
			expected: "1-2",
			changed:  true,
		},
		{
			name:     "banchi/N番地N棟_建物番号",
			input:    "1番地1棟301号",
			expected: "1 1棟301号",
			changed:  true,
		},
		{
			name:     "banchi/N番地のN_ひらがな",
			input:    "1番地の2",
			expected: "1-2",
			changed:  true,
		},
		{
			name:     "banchi/N番地ノN_カタカナ",
			input:    "26番地ノ1",
			expected: "26-1",
			changed:  true,
		},
		{
			name:     "banchi/N番地-N号_ハイフン付き",
			input:    "101番地-2808号",
			expected: "101-2808",
			changed:  true,
		},
		{
			name:     "banchi/N番地N号_連続数字",
			input:    "101番地3602号",
			expected: "101-3602",
			changed:  true,
		},
		{
			name:     "banchi/N番地N_後続数字",
			input:    "1番地2",
			expected: "1-2",
			changed:  true,
		},
		{
			name:     "banchi/N番地_末尾",
			input:    "9999番地",
			expected: "9999",
			changed:  true,
		},
		{
			name:     "banchi/N番地+建物名",
			input:    "129番地ツインビル",
			expected: "129 ツインビル",
			changed:  true,
		},
		{
			name:     "banchi/N番地M+建物名",
			input:    "11番地2さいたま新都心LAタワー30F",
			expected: "11-2 さいたま新都心LAタワー30F",
			changed:  true,
		},
		{
			name:     "banchi/N番地M+ビル名階",
			input:    "4番地3ウェルクビル5階",
			expected: "4-3 ウェルクビル5階",
			changed:  true,
		},
		// ban/ - 番パターン
		{
			name:     "ban/N番N号_基本",
			input:    "1番3号",
			expected: "1-3",
			changed:  true,
		},
		{
			name:     "ban/N番N-M号_ハイフン1つ",
			input:    "1番2-3号",
			expected: "1-2-3",
			changed:  true,
		},
		{
			name:     "ban/N番N-M-O号_ハイフン2つ",
			input:    "1番2-3-4号",
			expected: "1-2-3-4",
			changed:  true,
		},
		{
			name:     "ban/N番N-M-O-P-Q号_ハイフン多数",
			input:    "1番2-3-4-5-6号",
			expected: "1-2-3-4-5-6",
			changed:  true,
		},
		{
			name:     "ban/N番N-英数字号_部屋番号",
			input:    "22番5-A1002号",
			expected: "22-5 -A1002",
			changed:  true,
		},
		{
			name:     "ban/N番N_後続数字",
			input:    "1番3",
			expected: "1-3",
			changed:  true,
		},
		{
			name:     "ban/N番_末尾",
			input:    "1310番",
			expected: "1310",
			changed:  true,
		},
		{
			name:     "ban/N番_住所末尾",
			input:    "神奈川県川崎市幸区大宮町1310番",
			expected: "神奈川県川崎市幸区大宮町1310",
			changed:  true,
		},
		{
			name:     "ban/N番のN_ひらがな",
			input:    "510番の1",
			expected: "510-1",
			changed:  true,
		},
		{
			name:     "ban/N番のN_住所付き",
			input:    "愛知県小牧市大字河内屋新田字下岩倉杁510番の1",
			expected: "愛知県小牧市大字河内屋新田字下岩倉杁510-1",
			changed:  true,
		},
		// negative/ - 変換しないケース（基本）
		{
			name:     "negative/既にハイフン化済み",
			input:    "1-2-3",
			expected: "1-2-3",
			changed:  false,
		},
		{
			name:     "negative/空文字列",
			input:    "",
			expected: "",
			changed:  false,
		},
		// real/ - 実際の住所ケース
		{
			name:     "real/風祭154番1",
			input:    "神奈川県小田原市風祭154番1",
			expected: "神奈川県小田原市風祭154-1",
			changed:  true,
		},
		{
			name:     "real/大宮町1310番",
			input:    "神奈川県川崎市幸区大宮町1310番",
			expected: "神奈川県川崎市幸区大宮町1310",
			changed:  true,
		},
		{
			name:     "real/四之宮7番4",
			input:    "神奈川県平塚市四之宮一丁目7番4",
			expected: "神奈川県平塚市四之宮一丁目7-4",
			changed:  true,
		},
		{
			name:     "real/蒼前東9番28",
			input:    "青森県三戸郡階上町蒼前東二丁目9番28",
			expected: "青森県三戸郡階上町蒼前東二丁目9-28",
			changed:  true,
		},
		{
			name:     "real/滝ノ沢100番9",
			input:    "青森県南津軽郡大鰐町大字島田字滝ノ沢100番9",
			expected: "青森県南津軽郡大鰐町大字島田字滝ノ沢100-9",
			changed:  true,
		},
		{
			name:     "real/紺屋町4番8",
			input:    "静岡市葵区紺屋町4番8",
			expected: "静岡市葵区紺屋町4-8",
			changed:  true,
		},
		// ban/ - 番+建物パターン
		{
			name:     "ban/N番M棟_建物番号",
			input:    "千葉県船橋市行田三丁目1番12棟206号",
			expected: "千葉県船橋市行田三丁目1 12棟206号",
			changed:  true,
		},
		{
			name:     "ban/N番M棟_半角数字",
			input:    "千葉県船橋市習志野台六丁目8番4棟304号",
			expected: "千葉県船橋市習志野台六丁目8 4棟304号",
			changed:  true,
		},
		{
			name:     "special/N番街_商業施設",
			input:    "東京都港区台場一丁目5番街1号棟601号室",
			expected: "東京都港区台場一丁目5番街 1号棟601号室",
			changed:  true,
		},
		{
			name:     "ban/N番+建物名_カタカナ",
			input:    "神戸市中央区京町80番クリエイト神戸9階",
			expected: "神戸市中央区京町80 クリエイト神戸9階",
			changed:  true,
		},
		{
			name:     "ban/N番+建物名_同番号",
			input:    "神戸市中央区江戸町104番江戸町104ビル4階",
			expected: "神戸市中央区江戸町104 江戸町104ビル4階",
			changed:  true,
		},
		{
			name:     "ban/N番NのN+建物名",
			input:    "東京都千代田区西神田二丁目6番7の2共和15番館ビル2階",
			expected: "東京都千代田区西神田二丁目6-7-2 共和15番館ビル2階",
			changed:  true,
		},
		{
			name:     "banchi/N番地N号棟_建物番号",
			input:    "埼玉県三郷市早稲田六丁目1番地2号棟201号",
			expected: "埼玉県三郷市早稲田六丁目1 2号棟201号",
			changed:  true,
		},
		{
			name:     "ban/N番N-N号室_部屋番号",
			input:    "東京都千代田区三崎町三丁目2番6-1104号室レジディア水道橋",
			expected: "東京都千代田区三崎町三丁目2-6 -1104号室レジディア水道橋",
			changed:  true,
		},
		{
			name:     "banchi/N番地N号_琴平町",
			input:    "香川県仲多度郡琴平町榎井106番地5号",
			expected: "香川県仲多度郡琴平町榎井106-5",
			changed:  true,
		},
		{
			name:     "ban/NのN号+建物名",
			input:    "東京都千代田区一番町20の6号一番町マンション101号",
			expected: "東京都千代田区一番町20-6 一番町マンション101号",
			changed:  true,
		},
		{
			name:     "ban/N番M号+部屋番号",
			input:    "10番27号516",
			expected: "10-27 516",
			changed:  true,
		},
		{
			name:     "ban/N番M号+部屋番号_建物名",
			input:    "5番23号1丁目マンション301",
			expected: "5-23 1丁目マンション301",
			changed:  true,
		},
		{
			name:     "special/N-N-N号_末尾号",
			input:    "東京都江東区豊洲五丁目1-13-4107号",
			expected: "東京都江東区豊洲五丁目1-13-4107",
			changed:  true,
		},
		// special/ - 特殊パターン（番先、番屋敷、番戸、号地）
		{
			name:     "special/N番先_末尾",
			input:    "東京都中央区銀座四丁目1番先",
			expected: "東京都中央区銀座四丁目1番先",
			changed:  false,
		},
		{
			name:     "special/N番先+建物名",
			input:    "東京都中央区銀座四丁目1番先西銀座デパートB2F",
			expected: "東京都中央区銀座四丁目1番先 西銀座デパートB2F",
			changed:  true,
		},
		{
			name:     "special/N番先+読点+建物名",
			input:    "東京都中央区銀座四丁目1番先、北数寄屋ビル地下1階",
			expected: "東京都中央区銀座四丁目1番先 、北数寄屋ビル地下1階",
			changed:  true,
		},
		{
			name:     "special/N番先+直接建物名",
			input:    "東京都中央区銀座四丁目1番先北数寄屋ビル地下1階",
			expected: "東京都中央区銀座四丁目1番先 北数寄屋ビル地下1階",
			changed:  true,
		},
		{
			name:     "special/N番屋敷_基本",
			input:    "神戸市海岸通三丁目2番屋敷",
			expected: "神戸市海岸通三丁目2番屋敷",
			changed:  false,
		},
		{
			name:     "special/N番屋敷_大きい番号",
			input:    "神戸市元町通四丁目137番屋敷",
			expected: "神戸市元町通四丁目137番屋敷",
			changed:  false,
		},
		{
			name:     "special/N番戸",
			input:    "北海道札幌市中央区南一条西五丁目15番戸",
			expected: "北海道札幌市中央区南一条西五丁目15番戸",
			changed:  false,
		},
		{
			name:     "special/N号地N_複合",
			input:    "東京都千代田区神田佐久間河岸71号地1",
			expected: "東京都千代田区神田佐久間河岸71号地1",
			changed:  false,
		},
		{
			name:     "special/N号地_単独",
			input:    "東京都千代田区神田佐久間河岸78号地",
			expected: "東京都千代田区神田佐久間河岸78号地",
			changed:  false,
		},
		// bancho/ - 番町パターン（千代田区など）
		{
			name:     "bancho/一番町N+建物名1",
			input:    "東京都千代田区一番町5アトラスビル5階",
			expected: "東京都千代田区一番町5 アトラスビル5階",
			changed:  true,
		},
		{
			name:     "bancho/一番町N+建物名2",
			input:    "東京都千代田区一番町6一番町スクエア5階",
			expected: "東京都千代田区一番町6 一番町スクエア5階",
			changed:  true,
		},
		{
			name:     "bancho/一番町N+建物名3",
			input:    "東京都千代田区一番町6相模屋本社ビル7F",
			expected: "東京都千代田区一番町6 相模屋本社ビル7F",
			changed:  true,
		},
		{
			name:     "bancho/九番町N+建物名",
			input:    "東京都千代田区九番町3ビジネスセンター",
			expected: "東京都千代田区九番町3 ビジネスセンター",
			changed:  true,
		},
		{
			name:     "bancho/三番町N+建物名",
			input:    "東京都千代田区三番町12大妻女子大学",
			expected: "東京都千代田区三番町12 大妻女子大学",
			changed:  true,
		},
		{
			name:     "bancho/二番町N番-N",
			input:    "東京都千代田区二番町1番-2",
			expected: "東京都千代田区二番町1-2",
			changed:  true,
		},
		{
			name:     "bancho/二番町N番N-N",
			input:    "東京都千代田区二番町1番2-732",
			expected: "東京都千代田区二番町1-2-732",
			changed:  true,
		},
		{
			name:     "bancho/備前町N番N-N",
			input:    "茨城県水戸市備前町7番32-610",
			expected: "茨城県水戸市備前町7-32-610",
			changed:  true,
		},
		{
			name:     "special/N-N-N室_部屋番号",
			input:    "東京都千代田区永田町二丁目17-10-202室",
			expected: "東京都千代田区永田町二丁目17-10 -202室",
			changed:  true,
		},
		{
			name:     "bancho/三番町N番+建物名",
			input:    "東京都千代田区三番町五丁目11番パークハウス三番町1301号",
			expected: "東京都千代田区三番町五丁目11 パークハウス三番町1301号",
			changed:  true,
		},
		{
			name:     "bancho/四番町N番-N号",
			input:    "東京都千代田区四番町六丁目11番-1004号",
			expected: "東京都千代田区四番町六丁目11-1004",
			changed:  true,
		},
		{
			name:     "bancho/四番町N番N+建物名",
			input:    "東京都千代田区四番町9番10パークコート四番町1003号",
			expected: "東京都千代田区四番町9-10 パークコート四番町1003号",
			changed:  true,
		},
		{
			name:     "ban/N番N-英数字_部屋番号1",
			input:    "東京都中央区日本橋箱崎町44番5-B1201",
			expected: "東京都中央区日本橋箱崎町44-5 -B1201",
			changed:  true,
		},
		{
			name:     "ban/N番N-英数字_部屋番号2",
			input:    "東京都中央区日本橋箱崎町44番5-B501",
			expected: "東京都中央区日本橋箱崎町44-5 -B501",
			changed:  true,
		},
		// negative/ - 変換しないケース（街区）
		{
			name:     "negative/N街区M号_基本",
			input:    "宮崎県都城市平江町13街区5号",
			expected: "宮崎県都城市平江町13街区5号",
			changed:  false,
		},
		{
			name:     "negative/N街区M号_別例",
			input:    "宮崎県都城市姫城町32街区3号",
			expected: "宮崎県都城市姫城町32街区3号",
			changed:  false,
		},
		// special/ - 階・F パターン
		{
			name:     "special/N-N-N-NF_フロア表記",
			input:    "東京都千代田区平河町2-2-5-1F",
			expected: "東京都千代田区平河町2-2-5 -1F",
			changed:  true,
		},
		{
			name:     "special/N番地先+建物名",
			input:    "東京都中央区銀座五丁目4番地先数寄屋橋シヨツピングセンター内223号",
			expected: "東京都中央区銀座五丁目4番地先 数寄屋橋シヨツピングセンター内223号",
			changed:  true,
		},
		{
			name:     "special/N番耕地N番地N",
			input:    "愛媛県八幡浜市大字郷1番耕地12番地1",
			expected: "愛媛県八幡浜市大字郷1番耕地12-1",
			changed:  true,
		},
		{
			name:     "special/N-N-N階",
			input:    "東京都千代田区平河町二丁目5-3-5階",
			expected: "東京都千代田区平河町二丁目5-3 -5階",
			changed:  true,
		},
		// negative/ - 変換しないケース（番町+街区）
		{
			name:     "negative/N番町N街区",
			input:    "桔梗が丘6番町3街区",
			expected: "桔梗が丘6番町3街区",
			changed:  false,
		},
		// negative/ - 変換しないケース（地名に番が含まれる）
		{
			name:     "negative/地名に番_番ケ谷",
			input:    "津山市1宮1番ケ谷1031",
			expected: "津山市1宮1番ケ谷1031",
			changed:  false,
		},
		// negative/ - 変換しないケース（番町+丁目）
		{
			name:     "negative/番町N丁目_基本",
			input:    "一番町1丁目",
			expected: "一番町1丁目",
			changed:  false,
		},
		{
			name:     "negative/番町N丁目_住所付き",
			input:    "刈谷市一番町2丁目",
			expected: "刈谷市一番町2丁目",
			changed:  false,
		},
		// negative/ - 変換しないケース（無番地）
		{
			name:     "negative/無番地_村",
			input:    "新潟県中蒲原郡新飯田村無番地",
			expected: "新潟県中蒲原郡新飯田村無番地",
			changed:  false,
		},
		{
			name:     "negative/無番地_町",
			input:    "神奈川県横須賀市田浦港町無番地",
			expected: "神奈川県横須賀市田浦港町無番地",
			changed:  false,
		},
		{
			name:     "negative/無番地_大字",
			input:    "愛知県海部郡飛島村大字政成新田無番地",
			expected: "愛知県海部郡飛島村大字政成新田無番地",
			changed:  false,
		},
		// negative/ - 変換しないケース（街区）
		{
			name:     "negative/N街区_末尾",
			input:    "愛知県知立市知立駅周辺10街区",
			expected: "愛知県知立市知立駅周辺10街区",
			changed:  false,
		},
		{
			name:     "negative/N-N街区_ハイフン付き",
			input:    "愛知県知立市知立駅周17-1街区",
			expected: "愛知県知立市知立駅周17-1街区",
			changed:  false,
		},
		// negative/ - 変換しないケース（条：札幌式住所）
		{
			name:     "negative/条_北1条西1丁目",
			input:    "北海道札幌市中央区北1条西1丁目",
			expected: "北海道札幌市中央区北1条西1丁目",
			changed:  false,
		},
		{
			name:     "negative/条_北10条東5丁目",
			input:    "北海道札幌市東区北10条東5丁目",
			expected: "北海道札幌市東区北10条東5丁目",
			changed:  false,
		},
		{
			name:     "negative/条_南3条西4丁目",
			input:    "北海道札幌市中央区南3条西4丁目",
			expected: "北海道札幌市中央区南3条西4丁目",
			changed:  false,
		},
		// issue87/ - Issue #87 パターン（N番NのN号、N番地のN号）
		{
			name:     "issue87/N番NのN号_基本",
			input:    "16番1の50号",
			expected: "16-1-50",
			changed:  true,
		},
		{
			name:     "issue87/N番NのN_号なし",
			input:    "2番10の1",
			expected: "2-10-1",
			changed:  true,
		},
		{
			name:     "issue87/N番地のN号_基本",
			input:    "1番地の11号",
			expected: "1-11",
			changed:  true,
		},
		{
			name:     "issue87/N番地のN号_別例",
			input:    "5番地の3号",
			expected: "5-3",
			changed:  true,
		},
		{
			name:     "issue87/N番NノN号_カタカナ",
			input:    "10番5ノ2号",
			expected: "10-5-2",
			changed:  true,
		},
		{
			name:     "issue87/N番地ノN号_カタカナ",
			input:    "3番地ノ7号",
			expected: "3-7",
			changed:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := AddressNumbersToHyphen(tt.input)
			if result != tt.expected {
				t.Errorf("AddressNumbersToHyphen(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("AddressNumbersToHyphen(%q) changed = %v, want %v", tt.input, changed, tt.changed)
			}
		})
	}
}

func BenchmarkAddressNumbersToHyphen(b *testing.B) {
	testCases := []string{
		"1番地の2",
		"1番地2",
		"9999番地",
		"1番3号",
		"1-2-3",
	}

	for _, tc := range testCases {
		b.Run("input_"+tc, func(b *testing.B) {
			for b.Loop() {
				AddressNumbersToHyphen(tc)
			}
		})
	}
}

func TestAddSpaceAfterFirstArabicNumber(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		{
			name:     "simple hyphenated pattern",
			input:    "1-2-3アトラスビル",
			expected: "1-2-3 アトラスビル",
			changed:  true,
		},
		{
			name:     "already has space",
			input:    "1-2-3 ビル",
			expected: "1-2-3 ビル",
			changed:  false,
		},
		{
			name:     "no hyphenated pattern",
			input:    "東京都千代田区",
			expected: "東京都千代田区",
			changed:  false,
		},
		{
			name:     "hyphenated pattern with suffix",
			input:    "1-2-3ビル",
			expected: "1-2-3 ビル",
			changed:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := addSpaceAfterFirstArabicNumber(tt.input)
			if result != tt.expected {
				t.Errorf("addSpaceAfterFirstArabicNumber(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("addSpaceAfterFirstArabicNumber(%q) changed = %v, want %v", tt.input, changed, tt.changed)
			}
		})
	}
}

func TestAddSpaceAfterNumberBeforeJapanese(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		{
			name:     "number before katakana building name",
			input:    "一番町5アトラス",
			expected: "一番町5 アトラス",
			changed:  true,
		},
		{
			name:     "number before kanji building name",
			input:    "九番町3東京ビル",
			expected: "九番町3 東京ビル",
			changed:  true,
		},
		{
			name:     "number before 丁目 (should not add space)",
			input:    "1丁目",
			expected: "1丁目",
			changed:  false,
		},
		{
			name:     "already has space",
			input:    "5 アトラス",
			expected: "5 アトラス",
			changed:  false,
		},
		{
			name:     "Hokkaido line address - 南9線 (should not add space)",
			input:    "姉別原野南9線",
			expected: "姉別原野南9線",
			changed:  false,
		},
		{
			name:     "Hokkaido line address - 北1線西 (should not add space)",
			input:    "温根別町北1線西",
			expected: "温根別町北1線西",
			changed:  false,
		},
		{
			name:     "Hokkaido line address - 新野7線 (should not add space)",
			input:    "新野7線",
			expected: "新野7線",
			changed:  false,
		},
		{
			name:     "Iwate chiwari address - 第35地割 (should not add space)",
			input:    "大更第35地割",
			expected: "大更第35地割",
			changed:  false,
		},
		{
			name:     "Iwate chiwari address - 第1地割 (should not add space)",
			input:    "平笠第1地割",
			expected: "平笠第1地割",
			changed:  false,
		},
		{
			name:     "Fukushima chiwari address - 下地割甲 (should not add space)",
			input:    "磐見下地割甲",
			expected: "磐見下地割甲",
			changed:  false,
		},
		{
			name:     "Iwate chiwari with koaza - 第8地割800平 (should not add space)",
			input:    "鴬宿第8地割800平",
			expected: "鴬宿第8地割800平",
			changed:  false,
		},
		{
			name:     "town name with 区 - 北刈谷2区100B (should not add space)",
			input:    "刈谷市北刈谷2区100B",
			expected: "刈谷市北刈谷2区100B",
			changed:  false,
		},
		{
			name:     "town name with 区 - 北刈谷2区 only (should not add space)",
			input:    "北刈谷2区",
			expected: "北刈谷2区",
			changed:  false,
		},
		// Pattern: 漢字N漢字M丁目 (e.g., Nakashibetsu-style: 東1北2丁目)
		// Don't add space when pattern is: 数字+漢字+数字+丁目
		{
			name:     "漢字N漢字M丁目 pattern - 東1北2丁目 (should not add space between 1 and 北)",
			input:    "中標津町東1北2丁目",
			expected: "中標津町東1北2丁目",
			changed:  false,
		},
		{
			name:     "漢字N漢字M丁目 pattern - 東6南6丁目 (should not add space between 6 and 南)",
			input:    "中標津町東6南6丁目",
			expected: "中標津町東6南6丁目",
			changed:  false,
		},
		{
			name:     "漢字N漢字M丁目 pattern - 西2北3丁目 (should not add space between 2 and 北)",
			input:    "中標津町西2北3丁目",
			expected: "中標津町西2北3丁目",
			changed:  false,
		},
		// Tree-counting koaza patterns (N本通, N本松, etc.)
		// Issue #63: Don't add space before 本通/本松/本杉/本柳/本木
		{
			name:     "tree-counting koaza - 3本通線 (should not add space between 3 and 本通)",
			input:    "標茶町虹別市街3本通線",
			expected: "標茶町虹別市街3本通線",
			changed:  false,
		},
		{
			name:     "tree-counting koaza - 姉大1本松 (should not add space between 1 and 本松)",
			input:    "千代田町姉大1本松",
			expected: "千代田町姉大1本松",
			changed:  false,
		},
		{
			name:     "tree-counting koaza - 姉2本松 (should not add space between 2 and 本松)",
			input:    "千代田町姉2本松",
			expected: "千代田町姉2本松",
			changed:  false,
		},
		// Field measurement koaza patterns (Nの坪, Nノ坪)
		// Issue #63: Don't add space before の坪/ノ坪
		{
			name:     "field measurement koaza - 8の坪 (should not add space between 8 and の坪)",
			input:    "千代田町渡瀬8の坪",
			expected: "千代田町渡瀬8の坪",
			changed:  false,
		},
		{
			name:     "field measurement koaza - 8ノ坪 (should not add space between 8 and ノ坪)",
			input:    "千代田町渡瀬8ノ坪",
			expected: "千代田町渡瀬8ノ坪",
			changed:  false,
		},
		// Multi-village communal land patterns (Nケ村入会地)
		// Issue #63: Don't add space before ケ村/ヶ村/か村/カ村
		{
			name:     "multi-village communal land - 2ケ村入会地 (should not add space between 2 and ケ村)",
			input:    "南砺市井波外2ケ村入会地",
			expected: "南砺市井波外2ケ村入会地",
			changed:  false,
		},
		{
			name:     "multi-village communal land - 4ケ村入会地 (should not add space between 4 and ケ村)",
			input:    "南砺市井波外4ケ村入会地",
			expected: "南砺市井波外4ケ村入会地",
			changed:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := addSpaceAfterNumberBeforeJapanese(tt.input)
			if result != tt.expected {
				t.Errorf("addSpaceAfterNumberBeforeJapanese(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("addSpaceAfterNumberBeforeJapanese(%q) changed = %v, want %v", tt.input, changed, tt.changed)
			}
		})
	}
}

// Test for kanji block name + N号 pattern
// Issue #63: kanjiBlockGoPattern conversion is DISABLED to avoid breaking Hokkaido addresses
// like "中線1号", "西神楽南13号" where N号 is part of koaza
func TestKanjiBlockGoPattern(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		// "渡辺" is an actual address name in Osaka (大阪市中央区道頓堀の街区名)
		// Should NOT convert because N号 could be part of the address name
		{"渡辺3号", "渡辺3号"},
	}

	for _, tt := range tests {
		result, _ := AddressNumbersToHyphen(tt.input)
		t.Logf("Input: %q -> Got: %q (Want: %q)", tt.input, result, tt.expected)
		if result != tt.expected {
			t.Errorf("Input: %q\nGot:  %q\nWant: %q", tt.input, result, tt.expected)
		}
	}
}

// Test for Hokkaido colonial division addresses (N線N号, N線西N号, etc.)
// Issue #192, #193: 線・号 patterns should be preserved as-is
func TestSenGoPattern(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		// Basic N線N号 pattern - should NOT be converted
		{
			name:     "sen-go pattern (N線N号) - keep as is",
			input:    "西神楽1線24号",
			expected: "西神楽1線24号",
			changed:  false,
		},
		{
			name:     "sen-go pattern with full address",
			input:    "北海道旭川市西神楽1線24号",
			expected: "北海道旭川市西神楽1線24号",
			changed:  false,
		},
		{
			name:     "sen-go pattern (東鷹栖1線11号)",
			input:    "北海道旭川市東鷹栖1線11号",
			expected: "北海道旭川市東鷹栖1線11号",
			changed:  false,
		},
		// N線西N号 pattern (with direction) - should NOT be converted
		{
			name:     "sen-direction-go pattern (N線西N号) - keep as is",
			input:    "10線西5号",
			expected: "10線西5号",
			changed:  false,
		},
		{
			name:     "sen-direction-go pattern with full address",
			input:    "北海道上川郡鷹栖町10線西5号",
			expected: "北海道上川郡鷹栖町10線西5号",
			changed:  false,
		},
		{
			name:     "sen-direction-go pattern (N線東N号)",
			input:    "北海道上川郡鷹栖町10線東3号",
			expected: "北海道上川郡鷹栖町10線東3号",
			changed:  false,
		},
		{
			name:     "sen-direction-go pattern (N線南N号)",
			input:    "北海道上川郡鷹栖町10線南2号",
			expected: "北海道上川郡鷹栖町10線南2号",
			changed:  false,
		},
		{
			name:     "sen-direction-go pattern (N線北N号)",
			input:    "北海道上川郡鷹栖町10線北1号",
			expected: "北海道上川郡鷹栖町10線北1号",
			changed:  false,
		},
		// 線 only (without 号) - should NOT be converted to hyphen
		{
			name:     "sen only pattern",
			input:    "北海道上川郡鷹栖町7線",
			expected: "北海道上川郡鷹栖町7線",
			changed:  false,
		},
		// 線西 pattern (without 号)
		{
			name:     "sen-direction only pattern",
			input:    "北海道上川郡鷹栖町10線西",
			expected: "北海道上川郡鷹栖町10線西",
			changed:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := AddressNumbersToHyphen(tt.input)
			if result != tt.expected {
				t.Errorf("AddressNumbersToHyphen(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("AddressNumbersToHyphen(%q) changed = %v, want %v", tt.input, changed, tt.changed)
			}
		})
	}
}

// Test for Issue #63: Hokkaido special address patterns
// These patterns should NOT have N号 converted to -N because N号 is part of koaza
func TestHokkaidoSpecialPatterns(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		// Pattern: 中線N号 (koaza ends with N号)
		{
			name:     "chusen-go pattern - 中線1号 (should NOT convert)",
			input:    "北海道士別市温根別町中線1号",
			expected: "北海道士別市温根別町中線1号",
			changed:  false,
		},
		{
			name:     "chusen-go pattern - 中線10号 (should NOT convert)",
			input:    "北海道士別市温根別町中線10号",
			expected: "北海道士別市温根別町中線10号",
			changed:  false,
		},
		// Pattern: 西神楽南N号 (oaza: 西神楽南, koaza: N号)
		{
			name:     "nishikagura-minami-go - 西神楽南13号 (should NOT convert)",
			input:    "北海道旭川市西神楽南13号",
			expected: "北海道旭川市西神楽南13号",
			changed:  false,
		},
		// Pattern: アケボノN丁目 (place name ends with ノ, should NOT convert ノN to -N)
		{
			name:     "akebono pattern - アケボノ1丁目 (should NOT convert ノ1 to -1)",
			input:    "アケボノ1丁目",
			expected: "アケボノ1丁目",
			changed:  false,
		},
		{
			name:     "akebono pattern - 音別町アケボノ1丁目 (should NOT convert)",
			input:    "北海道釧路市音別町アケボノ1丁目",
			expected: "北海道釧路市音別町アケボノ1丁目",
			changed:  false,
		},
		// Pattern: 南大沼ノ1 (Hokkaido koaza with ノN, should NOT convert)
		{
			name:     "furano-no pattern - 南大沼ノ1 (should NOT convert)",
			input:    "北海道富良野市南大沼ノ1",
			expected: "北海道富良野市南大沼ノ1",
			changed:  false,
		},
		{
			name:     "furano-no pattern - 麓郷市街地ノ4 (should NOT convert)",
			input:    "北海道富良野市麓郷市街地ノ4",
			expected: "北海道富良野市麓郷市街地ノ4",
			changed:  false,
		},
		// Pattern: 第N基線 (should NOT add space before 基線)
		{
			name:     "kisen pattern - 岩内町第1基線 (should NOT add space before 基線)",
			input:    "北海道帯広市岩内町第1基線",
			expected: "北海道帯広市岩内町第1基線",
			changed:  false,
		},
		{
			name:     "kisen pattern - 幌呂原野第2基線 (should NOT add space before 基線)",
			input:    "北海道阿寒郡鶴居村幌呂原野第2基線",
			expected: "北海道阿寒郡鶴居村幌呂原野第2基線",
			changed:  false,
		},
		// Contrast: legitimate のN pattern after 番 should still be converted
		{
			name:     "legitimate no pattern - 6番7の2 (should convert)",
			input:    "東京都千代田区6番7の2",
			expected: "東京都千代田区6-7-2",
			changed:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := AddressNumbersToHyphen(tt.input)
			if result != tt.expected {
				t.Errorf("AddressNumbersToHyphen(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("AddressNumbersToHyphen(%q) changed = %v, want %v", tt.input, changed, tt.changed)
			}
		})
	}
}

// TestBankawaPattern tests that N番川 patterns are preserved (Issue #63 Pattern 11)
func TestBankawaPattern(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "青山奥2番川 - should NOT separate",
			input:    "青山奥2番川",
			expected: "青山奥2番川",
		},
		{
			name:     "青山奥3番川 - should NOT separate",
			input:    "青山奥3番川",
			expected: "青山奥3番川",
		},
		{
			name:     "青山奥4番川 - should NOT separate",
			input:    "青山奥4番川",
			expected: "青山奥4番川",
		},
		{
			name:     "regular N番 pattern - should convert",
			input:    "1丁目2番",
			expected: "1丁目2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _ := AddressNumbersToHyphen(tt.input)
			if result != tt.expected {
				t.Errorf("AddressNumbersToHyphen(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

// TestBunkuPattern tests that N分区 patterns don't get space inserted (Issue #63 Pattern 12)
func TestBunkuPattern(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "11分区 - should NOT insert space before 分区",
			input:    "宮戸11分区",
			expected: "宮戸11分区",
		},
		{
			name:     "1分区 - should NOT insert space before 分区",
			input:    "宮戸1分区",
			expected: "宮戸1分区",
		},
		{
			name:     "5分区 - should NOT insert space before 分区",
			input:    "宮戸5分区",
			expected: "宮戸5分区",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _ := addSpaceAfterNumberBeforeJapanese(tt.input)
			if result != tt.expected {
				t.Errorf("addSpaceAfterNumberBeforeJapanese(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

// TestKihokuKinanPattern tests that 第N基北/基南 patterns don't get space inserted (Issue #63 Pattern 13)
func TestKihokuKinanPattern(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "第1基北1線 - should NOT insert space before 基北",
			input:    "幌呂原野第1基北1線",
			expected: "幌呂原野第1基北1線",
		},
		{
			name:     "第2基南2線 - should NOT insert space before 基南",
			input:    "幌呂原野第2基南2線",
			expected: "幌呂原野第2基南2線",
		},
		{
			name:     "第1基北1線東 - should NOT insert space before 基北",
			input:    "幌呂原野第1基北1線東",
			expected: "幌呂原野第1基北1線東",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _ := addSpaceAfterNumberBeforeJapanese(tt.input)
			if result != tt.expected {
				t.Errorf("addSpaceAfterNumberBeforeJapanese(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

// TestNotoriPattern tests that Nの通り patterns don't get space inserted (Issue #63 Pattern 14)
func TestNotoriPattern(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "太田1の通り - should NOT insert space before の通",
			input:    "太田1の通り",
			expected: "太田1の通り",
		},
		{
			name:     "霧多布村3の通 - should NOT insert space before の通",
			input:    "霧多布村3の通",
			expected: "霧多布村3の通",
		},
		{
			name:     "横15の通 - should NOT insert space before の通",
			input:    "横15の通",
			expected: "横15の通",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _ := addSpaceAfterNumberBeforeJapanese(tt.input)
			if result != tt.expected {
				t.Errorf("addSpaceAfterNumberBeforeJapanese(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

// TestBantsuPattern tests that N番通 patterns are preserved (Issue #63 Pattern 16)
func TestBantsuPattern(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "南1番通 - should NOT separate N番通",
			input:    "南1番通",
			expected: "南1番通",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _ := AddressNumbersToHyphen(tt.input)
			if result != tt.expected {
				t.Errorf("AddressNumbersToHyphen(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

// TestChonaikaiPattern tests that N町内会 patterns don't get space inserted (Issue #63 Pattern 15)
func TestChonaikaiPattern(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "国見14町内会 - should NOT insert space before 町内会",
			input:    "国見14町内会",
			expected: "国見14町内会",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _ := addSpaceAfterNumberBeforeJapanese(tt.input)
			if result != tt.expected {
				t.Errorf("addSpaceAfterNumberBeforeJapanese(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestRinpanPattern(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "国有林71林班 - should NOT insert space before 林班",
			input:    "国有林71林班",
			expected: "国有林71林班",
		},
		{
			name:     "国有林42林班イ小班 - should NOT insert space before 林班",
			input:    "国有林42林班イ小班",
			expected: "国有林42林班イ小班",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _ := addSpaceAfterNumberBeforeJapanese(tt.input)
			if result != tt.expected {
				t.Errorf("addSpaceAfterNumberBeforeJapanese(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

// TestAzaPattern tests that N字 patterns don't get space inserted (Ishikawa-style koaza)
func TestAzaPattern(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "飯山町1字 - should NOT insert space before 字",
			input:    "飯山町1字",
			expected: "飯山町1字",
		},
		{
			name:     "鹿島路町10字 - should NOT insert space before 字",
			input:    "鹿島路町10字",
			expected: "鹿島路町10字",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _ := addSpaceAfterNumberBeforeJapanese(tt.input)
			if result != tt.expected {
				t.Errorf("addSpaceAfterNumberBeforeJapanese(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

// TestChoPattern tests that N丁 patterns don't get space inserted (Osaka-style chome)
func TestChoPattern(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "庭代台4丁 - should NOT insert space before 丁",
			input:    "庭代台4丁",
			expected: "庭代台4丁",
		},
		{
			name:     "茶山台1丁 - should NOT insert space before 丁",
			input:    "茶山台1丁",
			expected: "茶山台1丁",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _ := addSpaceAfterNumberBeforeJapanese(tt.input)
			if result != tt.expected {
				t.Errorf("addSpaceAfterNumberBeforeJapanese(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

// TestNoMachiPattern tests that NノM町 patterns (Niigata-style) are preserved
func TestNoMachiPattern(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "礎町通1ノ町 - should preserve ノ町",
			input:    "礎町通1ノ町",
			expected: "礎町通1ノ町",
		},
		{
			name:     "礎町通2ノ町 - should preserve ノ町",
			input:    "礎町通2ノ町",
			expected: "礎町通2ノ町",
		},
		{
			name:     "regular Nの pattern should still convert",
			input:    "町1の2共",
			expected: "町1-2 共",
		},
		{
			name:     "Nの pattern at end should still convert",
			input:    "町1の2",
			expected: "町1-2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _ := AddressNumbersToHyphen(tt.input)
			if result != tt.expected {
				t.Errorf("AddressNumbersToHyphen(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

// TestNoMachiPatternAddSpace tests that NノM町 patterns are preserved by addSpaceAfterNumberBeforeJapanese
func TestNoMachiPatternAddSpace(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "礎町通1ノ町 - should NOT insert space before ノ町",
			input:    "礎町通1ノ町",
			expected: "礎町通1ノ町",
		},
		{
			name:     "礎町通2ノ町 - should NOT insert space before ノ町",
			input:    "礎町通2ノ町",
			expected: "礎町通2ノ町",
		},
		{
			name:     "新潟市中央区礎町通1ノ町 - should NOT insert space before ノ町",
			input:    "新潟市中央区礎町通1ノ町",
			expected: "新潟市中央区礎町通1ノ町",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _ := addSpaceAfterNumberBeforeJapanese(tt.input)
			if result != tt.expected {
				t.Errorf("addSpaceAfterNumberBeforeJapanese(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}
