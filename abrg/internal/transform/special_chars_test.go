package transform

import "testing"

func TestStandardizeSpecialChars(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		want        string
		wantChanged bool
	}{
		// ============================================================
		// specialMap tests
		// ============================================================
		// 之 → ノ (DB: 福島県郡山市喜久田町堀之内萱畑, 福島県いわき市久之浜町久之浜字真弓)
		{
			name:        "之→ノ: 喜久田町堀之内",
			input:       "福島県郡山市喜久田町堀之内",
			want:        "福島県郡山市喜久田町堀ノ内",
			wantChanged: true,
		},
		{
			name:        "之→ノ: 久之浜町久之浜",
			input:       "福島県いわき市久之浜町久之浜",
			want:        "福島県いわき市久ノ浜町久ノ浜",
			wantChanged: true,
		},
		// ヶ → ガ (DB: 秋田県にかほ市釜ヶ台, 秋田県由利本荘市松ヶ崎)
		// 「ヶ」は助数詞「箇」の略字で、地名では「ガ」と読むことが多い
		{
			name:        "ヶ→ガ: 釜ヶ台",
			input:       "秋田県にかほ市釜ヶ台",
			want:        "秋田県にかほ市釜ガ台",
			wantChanged: true,
		},
		{
			name:        "ヶ→ガ: 松ヶ崎",
			input:       "秋田県由利本荘市松ヶ崎",
			want:        "秋田県由利本荘市松ガ崎",
			wantChanged: true,
		},
		// ケ → ガ (DB: 福島県喜多方市東桜ガ丘)
		// 「ケ」も地名では「ヶ」と同様に扱う
		{
			name:        "ケ→ガ: 東桜ケ丘",
			input:       "福島県喜多方市東桜ケ丘",
			want:        "福島県喜多方市東桜ガ丘",
			wantChanged: true,
		},
		// が は変換しない（HiraganaToKatakanaで自然にガになる）
		// 「かがやき」→「カガヤキ」を正しく処理するため
		{
			name:        "が: 美しが丘（変換なし）",
			input:       "栃木県小山市美しが丘",
			want:        "栃木県小山市美しが丘",
			wantChanged: false,
		},
		{
			name:        "が: 自由が丘（変換なし）",
			input:       "北海道帯広市自由が丘",
			want:        "北海道帯広市自由が丘",
			wantChanged: false,
		},
		// 東入ル → 東入 (DB: 京都府京都市上京区上長者町通千本東入愛染寺町)
		{
			name:        "東入ル→東入: 京都通り名",
			input:       "京都府京都市上京区上長者町通千本東入ル愛染寺町",
			want:        "京都府京都市上京区上長者町通千本東入愛染寺町",
			wantChanged: true,
		},
		// 西入ル → 西入 (DB: 京都府京都市上京区中立売通浄福寺西入下る加賀屋町)
		{
			name:        "西入ル→西入: 京都通り名",
			input:       "京都府京都市上京区中立売通浄福寺西入ル下る加賀屋町",
			want:        "京都府京都市上京区中立売通浄福寺西入下る加賀屋町",
			wantChanged: true,
		},
		// ============================================================
		// itaijiMap tests (異体字)
		// Characters that exist in ABR DB
		// ============================================================
		// 竈 → 釜 (塩竈市→塩釜市)
		{
			name:        "竈→釜: 塩竈市",
			input:       "宮城県塩竈市新浜町三丁目23番5号",
			want:        "宮城県塩釜市新浜町三丁目23番5号",
			wantChanged: true,
		},
		// 繩 → 縄 (DB: 福島県福島市上名倉字繩添)
		{
			name:        "繩→縄: 字繩添",
			input:       "福島県福島市上名倉字繩添",
			want:        "福島県福島市上名倉字縄添",
			wantChanged: true,
		},
		// 﨑 → 崎 (DB: 岐阜県下呂市萩原町尾﨑, 島根県奥出雲町竹﨑)
		{
			name:        "﨑→崎: 萩原町尾﨑",
			input:       "岐阜県下呂市萩原町尾﨑",
			want:        "岐阜県下呂市萩原町尾崎", // 萩 is preserved (not converted to 荻)
			wantChanged: true,
		},
		{
			name:        "﨑→崎: 竹﨑",
			input:       "島根県奥出雲町竹﨑",
			want:        "島根県奥出雲町竹崎",
			wantChanged: true,
		},
		// 龍 → 竜 (DB: 栃木県小山市大字高椅龍神社, 福島県柳津町大字久保田字龍ケ沢)
		{
			name:        "龍→竜: 龍神社",
			input:       "栃木県小山市大字高椅龍神社",
			want:        "栃木県小山市大字高椅竜神社",
			wantChanged: true,
		},
		{
			name:        "龍→竜: 字龍ケ沢",
			input:       "福島県柳津町大字久保田字龍ケ沢",
			want:        "福島県柳津町大字久保田字竜ガ沢",
			wantChanged: true,
		},
		// 瀧 → 滝 (DB: 宮城県大衡村大森字瀧ノ沢, 福島県白河市大信隈戸字瀧ノ沢)
		{
			name:        "瀧→滝: 字瀧ノ沢",
			input:       "宮城県大衡村大森字瀧ノ沢",
			want:        "宮城県大衡村大森字滝ノ沢",
			wantChanged: true,
		},
		// 嶋 → 島 (DB: 秋田県大仙市大曲西根字上嶋, 秋田県大仙市横堀字福嶋)
		{
			name:        "嶋→島: 字上嶋",
			input:       "秋田県大仙市大曲西根字上嶋",
			want:        "秋田県大仙市大曲西根字上島",
			wantChanged: true,
		},
		{
			name:        "嶋→島: 字福嶋",
			input:       "秋田県大仙市横堀字福嶋",
			want:        "秋田県大仙市横堀字福島",
			wantChanged: true,
		},
		// 澁 → 渋 (DB: 福島県会津美里町福重岡字澁田乙, 京都府南山城村大字北大河原小字澁久)
		{
			name:        "澁→渋: 字澁田乙",
			input:       "福島県会津美里町福重岡字澁田乙",
			want:        "福島県会津美里町福重岡字渋田乙",
			wantChanged: true,
		},
		// 廣 → 広 (DB: 福島県会津坂下町大字中泉字廣面, 福島県喜多方市松山町鳥見山字廣畑)
		{
			name:        "廣→広: 字廣面",
			input:       "福島県会津坂下町大字中泉字廣面",
			want:        "福島県会津坂下町大字中泉字広面",
			wantChanged: true,
		},
		{
			name:        "廣→広: 字廣畑",
			input:       "福島県喜多方市松山町鳥見山字廣畑",
			want:        "福島県喜多方市松山町鳥見山字広畑",
			wantChanged: true,
		},
		// 澤 → 沢 (DB: 秋田県にかほ市象潟町西中野澤, 福島県喜多方市高郷町上郷字杉ノ澤)
		{
			name:        "澤→沢: 西中野澤",
			input:       "秋田県にかほ市象潟町西中野澤",
			want:        "秋田県にかほ市象潟町西中野沢",
			wantChanged: true,
		},
		{
			name:        "澤→沢: 字杉ノ澤",
			input:       "福島県喜多方市高郷町上郷字杉ノ澤",
			want:        "福島県喜多方市高郷町上郷字杉ノ沢",
			wantChanged: true,
		},
		// 濱 → 浜 (DB: 宮城県仙台市太白区秋保町境野字濱井場, 宮城県仙台市太白区秋保町長袋字濱坂)
		{
			name:        "濱→浜: 字濱井場",
			input:       "宮城県仙台市太白区秋保町境野字濱井場",
			want:        "宮城県仙台市太白区秋保町境野字浜井場",
			wantChanged: true,
		},
		// 髙 → 高 (DB: 宮城県東松島市浅井字髙田, 千葉県多古町髙津原)
		{
			name:        "髙→高: 字髙田",
			input:       "宮城県東松島市浅井字髙田",
			want:        "宮城県東松島市浅井字高田",
			wantChanged: true,
		},
		{
			name:        "髙→高: 髙津原",
			input:       "千葉県多古町髙津原",
			want:        "千葉県多古町高津原",
			wantChanged: true,
		},
		// 德 → 徳 (DB: 福島県西会津町群岡字德澤乙, 兵庫県南あわじ市市德長)
		{
			name:        "德→徳: 字德澤乙",
			input:       "福島県西会津町群岡字德澤乙",
			want:        "福島県西会津町群岡字徳沢乙",
			wantChanged: true,
		},
		{
			name:        "德→徳: 市德長",
			input:       "兵庫県南あわじ市市德長",
			want:        "兵庫県南あわじ市市徳長",
			wantChanged: true,
		},
		// 國 → 国 (DB: 兵庫県市川町甘地國森, 兵庫県南あわじ市神代國衙)
		{
			name:        "國→国: 國森",
			input:       "兵庫県市川町甘地國森",
			want:        "兵庫県市川町甘地国森",
			wantChanged: true,
		},
		{
			name:        "國→国: 神代國衙",
			input:       "兵庫県南あわじ市神代國衙",
			want:        "兵庫県南あわじ市神代国衙",
			wantChanged: true,
		},
		// 櫻 → 桜 (DB: 宮城県石巻市三輪田字櫻崎上, 福島県会津美里町雀林字櫻元)
		{
			name:        "櫻→桜: 字櫻崎上",
			input:       "宮城県石巻市三輪田字櫻崎上",
			want:        "宮城県石巻市三輪田字桜崎上",
			wantChanged: true,
		},
		{
			name:        "櫻→桜: 字櫻元",
			input:       "福島県会津美里町雀林字櫻元",
			want:        "福島県会津美里町雀林字桜元",
			wantChanged: true,
		},
		// 萬 → 万 (DB: 福島県郡山市片平町萬代山, 宮城県柴田町大字船岡字萬影)
		{
			name:        "萬→万: 萬代山",
			input:       "福島県郡山市片平町萬代山",
			want:        "福島県郡山市片平町万代山",
			wantChanged: true,
		},
		{
			name:        "萬→万: 字萬影",
			input:       "宮城県柴田町大字船岡字萬影",
			want:        "宮城県柴田町大字船岡字万影",
			wantChanged: true,
		},
		// 榮 → 栄 (DB: 兵庫県豊岡市下鉢山昭榮, 兵庫県丹波篠山市川阪字榮ノ木皆地)
		{
			name:        "榮→栄: 昭榮",
			input:       "兵庫県豊岡市下鉢山昭榮",
			want:        "兵庫県豊岡市下鉢山昭栄",
			wantChanged: true,
		},
		{
			name:        "榮→栄: 字榮ノ木皆地",
			input:       "兵庫県丹波篠山市川阪字榮ノ木皆地",
			want:        "兵庫県丹波篠山市川阪字栄ノ木皆地",
			wantChanged: true,
		},
		// 驛 → 駅 (DB: 宮城県仙台市宮城野区福室字驛西)
		{
			name:        "驛→駅: 字驛西",
			input:       "宮城県仙台市宮城野区福室字驛西",
			want:        "宮城県仙台市宮城野区福室字駅西",
			wantChanged: true,
		},
		// 橫 → 横 (DB: 富山県富山市土橫手山, 富山県富山市橫樋)
		{
			name:        "橫→横: 橫手山",
			input:       "富山県富山市土橫手山",
			want:        "富山県富山市土横手山",
			wantChanged: true,
		},
		{
			name:        "橫→横: 橫樋",
			input:       "富山県富山市橫樋",
			want:        "富山県富山市横樋",
			wantChanged: true,
		},
		// 寶 → 宝 (DB: 福井県大野市寶慶寺, 山口県長門市日置上字寶地)
		{
			name:        "寶→宝: 寶慶寺",
			input:       "福井県大野市寶慶寺",
			want:        "福井県大野市宝慶寺",
			wantChanged: true,
		},
		{
			name:        "寶→宝: 字寶地",
			input:       "山口県長門市日置上字寶地",
			want:        "山口県長門市日置上字宝地",
			wantChanged: true,
		},
		// 惠 → 恵 (DB: 福島県田村市船引町芦沢字惠下, 滋賀県竜王町大字須惠)
		{
			name:        "惠→恵: 字惠下",
			input:       "福島県田村市船引町芦沢字惠下",
			want:        "福島県田村市船引町芦沢字恵下",
			wantChanged: true,
		},
		{
			name:        "惠→恵: 大字須惠",
			input:       "滋賀県竜王町大字須惠",
			want:        "滋賀県竜王町大字須恵",
			wantChanged: true,
		},
		// 眞 → 真 (DB: 福島県会津若松市河東町広野字眞行院甲, 秋田県北秋田市今泉字眞木屋)
		{
			name:        "眞→真: 字眞行院甲",
			input:       "福島県会津若松市河東町広野字眞行院甲",
			want:        "福島県会津若松市河東町広野字真行院甲",
			wantChanged: true,
		},
		{
			name:        "眞→真: 字眞木屋",
			input:       "秋田県北秋田市今泉字眞木屋",
			want:        "秋田県北秋田市今泉字真木屋",
			wantChanged: true,
		},
		// ============================================================
		// Incorrect itaiji mappings removed (#355)
		// These are distinct characters, NOT itaiji variants
		// ============================================================
		{
			name:        "秦 preserved: 秦野市",
			input:       "神奈川県秦野市",
			want:        "神奈川県秦野市",
			wantChanged: false,
		},
		{
			name:        "萩 preserved: 萩市",
			input:       "山口県萩市",
			want:        "山口県萩市",
			wantChanged: false,
		},
		{
			name:        "磐 preserved: 磐田市",
			input:       "静岡県磐田市",
			want:        "静岡県磐田市",
			wantChanged: false,
		},
		{
			name:        "桑 preserved: 桑名市",
			input:       "三重県桑名市",
			want:        "三重県桑名市",
			wantChanged: false,
		},
		{
			name:        "桒→桑 correct direction",
			input:       "桒原町",
			want:        "桑原町",
			wantChanged: true,
		},
		// ============================================================
		// No change cases
		// ============================================================
		{
			name:        "no change: standard kanji",
			input:       "東京都渋谷区渋谷一丁目",
			want:        "東京都渋谷区渋谷一丁目",
			wantChanged: false,
		},
		{
			name:        "no change: empty string",
			input:       "",
			want:        "",
			wantChanged: false,
		},
		// ============================================================
		// Multiple conversions
		// ============================================================
		{
			name:        "multiple: 德澤→徳沢 (德→徳 and 澤→沢)",
			input:       "福島県西会津町群岡字德澤乙",
			want:        "福島県西会津町群岡字徳沢乙",
			wantChanged: true,
		},
		// ============================================================
		// ABR外字縮退マップより追加 (サロゲートペア)
		// ============================================================
		{
			name:        "𠮷→吉: つちよし",
			input:       "東京都新宿区𠮷田町",
			want:        "東京都新宿区吉田町",
			wantChanged: true,
		},
		{
			name:        "𫝶→座: サロゲートペア",
			input:       "東京都千代田区𫝶間",
			want:        "東京都千代田区座間",
			wantChanged: true,
		},
		// ============================================================
		// ABR外字縮退マップより追加 (BMP文字)
		// ============================================================
		{
			name:        "强→強: 簡体字→繁体字",
			input:       "强化",
			want:        "強化",
			wantChanged: true,
		},
		{
			name:        "淸→清: 旧字体",
			input:       "淸水",
			want:        "清水",
			wantChanged: true,
		},
		{
			name:        "乄→〆: しめ",
			input:       "乄切",
			want:        "〆切",
			wantChanged: true,
		},
		// ============================================================
		// ABR外字縮退マップより追加 (複数文字変換)
		// ============================================================
		{
			name:        "𢉿→から: 1文字→2文字",
			input:       "𢉿松",
			want:        "から松",
			wantChanged: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, changed := StandardizeSpecialChars(tt.input)
			if got != tt.want {
				t.Errorf("StandardizeSpecialChars(%q) = %q, want %q", tt.input, got, tt.want)
			}
			if changed != tt.wantChanged {
				t.Errorf("StandardizeSpecialChars(%q) changed = %v, want %v", tt.input, changed, tt.wantChanged)
			}
		})
	}
}
