import { IPrefecture } from "@domain/prefecture";
import { PrefectureName } from "@domain/prefecture-name";

export const dummyPrefectures: IPrefecture[] = [
  {
    name: PrefectureName.TOKYO,
    cities: [
      // 「区」のケース
      {
        name: '千代田区',
        lg_code: '131016',
      },
      // 頭文字に「町」があるケース
      {
        name: '町田市',
        lg_code: '132098',
      },
      // マッチする都道府県が複数あるケース
      // 例: 東京都府中市と広島県府中市
      {
        name: '府中市',
        lg_code: '132063',
      },
      // 「郡」＋「町」ケース
      {
        name: '西多摩郡奥多摩町',
        lg_code: '133086',
      },
      // 郡に所蔵していない町のケース
      {
        name: '八丈町',
        lg_code: '134015',
      },
      // 村のケース
      {
        name: '小笠原村',
        lg_code: '134210',
      },
    ],
  },
  {
    name: PrefectureName.HIROSHIMA,
    cities: [
      // 普通の「市」ケース
      {
        name: '広島市',
        lg_code: '341002',
      },
      // 市の一部が「区」になっているケース
      {
        name: '広島市佐伯区',
        lg_code: '341088',
      },
      // マッチする都道府県が複数あるケース
      // 例: 東京都府中市と広島県府中市
      {
        name: '府中市',
        lg_code: '342084',
      },
      // 「郡」＋「町」ケース
      {
        name: '神石郡神石高原町',
        lg_code: '345458',
      },
    ],
  },
  {
    name: PrefectureName.KYOTO,
    cities: [
      // 普通の市（京都だけコードが分かれる場合があるので、京都を含む）
      {
        name: '京都市',
        lg_code: '261009',
      },
      // 市の下に「区」　（※北区は複数箇所にマッチする）
      {
        name: '京都市北区',
        lg_code: '261017',
      },
      {
        name: '京都市上京区',
        lg_code: '261025',
      },

      // 漢数字を含む市
      {
        name: '八幡市',
        lg_code: '262102',
      },

      // 相楽郡 の下に「町」と「村」
      {
        name: '相楽郡精華町',
        lg_code: '263664',
      },
      {
        name: '相楽郡南山城村',
        lg_code: '263672',
      },
    ],
  },
  {
    name: PrefectureName.NAGASAKI,
    cities: [
      // 都道府県名と同じ地名　”長崎”県”長崎”市
      {
        name: '長崎市',
        lg_code: '422011',
      },

      // 同一名称の郡と町 "東彼杵"郡 "東彼杵"町と、同一の郡に所属する町
      {
        name: '東彼杵郡東彼杵町',
        lg_code: '423211',
      },
      {
        name: '東彼杵郡川棚町',
        lg_code: '423220',
      },
      {
        name: '東彼杵郡波佐見町',
        lg_code: '423238',
      },

      // 漢数字を含む地名
      // "壱"が”一”と区別されていることを確認する
      {
        name: '壱岐市',
        lg_code: '422100',
      },
      {
        name: '五島市',
        lg_code: '422118',
      },
    ],
  },
  {
    name: PrefectureName.HOKKAIDO,
    cities: [
      // 北海道"上川郡"は北海道（上川管内北部） - 北海道（上川管内中部） - 北海道（十勝管内）の3つに分かれる
      {
        name: '上川郡鷹栖町',
        lg_code: '014524',
      },
      {
        name: '上川郡東神楽町',
        lg_code: '014532',
      },
      {
        name: '上川郡当麻町',
        lg_code: '014541',
      },
      {
        name: '上川郡比布町',
        lg_code: '014559',
      },
      {
        name: '上川郡愛別町',
        lg_code: '014567',
      },
      {
        name: '上川郡上川町',
        lg_code: '014575',
      },
      {
        name: '上川郡東川町',
        lg_code: '014583',
      },
      {
        name: '上川郡美瑛町',
        lg_code: '014591',
      },

      // 札幌市と「北区」
      {
        name: '札幌市',
        lg_code: '011002',
      },
      {
        name: '札幌市北区',
        lg_code: '011029',
      },

      // 漢数字を含む
      {
        name: '三笠市',
        lg_code: '012220',
      },
      {
        name: '千歳市',
        lg_code: '012246',
      },
      {
        name: '二海郡八雲町',
        lg_code: '013463',
      },
      {
        name: '十勝郡浦幌町',
        lg_code: '016497',
      },

      // 広島の地名を含む
      {
        name: '北広島市',
        lg_code: '012343',
      },

      // 静岡県の清水町と北海道の清水町
      {
        name: '上川郡清水町',
        lg_code: '016365',
      },
    ],
  },
  {
    name: PrefectureName.SHIZUOKA,
    cities: [
      // 浜松市と「北区」
      {
        name: '浜松市',
        lg_code: '221309',
      },
      {
        name: '浜松市北区',
        lg_code: '221350',
      },

      // 静岡県の清水町と北海道の清水町
      {
        name: '駿東郡清水町',
        lg_code: '223417',
      },

      // 町字でいきなり丁目がくる住所
      // 例：静岡県下田市2丁目4-26
      // https://github.com/digital-go-jp/abr-geocoder/issues/39
      {
        name: '下田市',
        lg_code: '222194',
      },
    ],
  },
  {
    name: PrefectureName.KAGOSHIMA,
    cities: [
      // 同じ漢字が続きやすい「志布志市」
      // 例：鹿児島県志布志市志布志町二丁目1番1号
      {
        name: '志布志市',
        lg_code: '462217',
      },

      // "鹿児島"県"鹿児島"市
      {
        name: '鹿児島市',
        lg_code: '462012',
      },
      // "鹿児島"県"鹿児島"郡
      {
        name: '鹿児島郡三島村',
        lg_code: '463035',
      },
      {
        name: '鹿児島郡十島村',
        lg_code: '463043',
      },
    ],
  },

  {
    name: PrefectureName.CHIBA,
    cities: [
      // 「市」を含む市
      {
        name: '市川市',
        lg_code: '122033',
      },
      {
        name: '市原市',
        lg_code: '122190',
      },
      // 漢数字を含む
      {
        name: '四街道市',
        lg_code: '122289',
      },
      {
        name: '八街市',
        lg_code: '122301',
      },
      {
        name: '山武郡九十九里町',
        lg_code: '124036',
      },
      {
        name: '長生郡一宮町',
        lg_code: '124214',
      },
    ],
  },

  {
    name: PrefectureName.ISHIKAWA,
    cities: [
      // 漢数字を含むケース
      {
        name: '七尾市',
        lg_code: '172022',
      },
      // 「市」を含むケース
      {
        name: '野々市市',
        lg_code: '172120',
      },
    ],
  },
  {
    name: PrefectureName.FUKUSHIMA,
    cities: [
      // ”石川”を含むケース
      {
        name: '石川郡石川町',
        lg_code: '075019',
      },
      {
        name: '石川郡玉川村',
        lg_code: '075027',
      },
      {
        name: '石川郡平田村',
        lg_code: '075035',
      },
      {
        name: '石川郡浅川町',
        lg_code: '075043',
      },
      {
        name: '石川郡古殿町',
        lg_code: '075051',
      },
    ],
  },
];

Object.freeze(dummyPrefectures);
