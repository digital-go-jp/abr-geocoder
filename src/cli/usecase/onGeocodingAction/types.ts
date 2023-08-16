export interface ITown {
  name: string;
  code: string;
}
export type TownOptions = ITown;

export class Town implements ITown {
  public readonly name: string;
  public readonly code: string;
  constructor({
    name,
    code
  }: TownOptions) {
    this.name = name;
    this.code = code;
    Object.freeze(this);
  }
}

export enum PrefectureName {
  HOKKAIDO = '北海道',
  AOMORI = '青森県',
  IWATE = '岩手県',
  MIYAGI = '宮城県',
  AKITA = '秋田県',
  YAMAGATA = '山形県',
  FUKUSHIMA = '福島県',
  IBARAKI = '茨城県',
  TOCHIGI = '栃木県',
  GUMMA = '群馬県',
  SAITAMA = '埼玉県',
  CHIBA = '千葉県',
  TOKYO = '東京都',
  KANAGAWA = '神奈川県',
  YAMANASHI = '山梨県',
  NAGANO = '長野県',
  NIIGATA = '新潟県',
  TOYAMA = '富山県',
  ISHIKAWA = '石川県',
  FUKUI = '福井県',
  SHIZUOKA = '静岡県',
  AICHI = '愛知県',
  GIFU = '岐阜県',
  MIE = '三重県',
  SHIGA = '滋賀県',
  KYOTO = '京都府',
  OSAKA = '大阪府',
  HYOGO = '兵庫県',
  NARA = '奈良県',
  WAKAYAMA = '和歌山県',
  OKAYAMA = '岡山県',
  HIROSHIMA = '広島県',
  TOTTORI = '鳥取県',
  SHIMANE = '島根県',
  YAMAGUCHI = '山口県',
  TOKUSHIMA = '徳島県',
  KAGAWA = '香川県',
  EHIME = '愛媛県',
  KOCHI = '高知県',
  FUKUOKA = '福岡県',
  SAGA = '佐賀県',
  NAGASAKI = '長崎県',
  OITA = '大分県',
  KUMAMOTO = '熊本県',
  MIYAZAKI = '宮崎県',
  KAGOSHIMA = '鹿児島県',
  OKINAWA = '沖縄県',
}

export type PrefectureType = PrefectureName.HOKKAIDO | 
PrefectureName.AOMORI |
PrefectureName.IWATE |
PrefectureName.MIYAGI |
PrefectureName.YAMAGATA |
PrefectureName.FUKUSHIMA |
PrefectureName.IBARAKI |
PrefectureName.TOCHIGI |
PrefectureName.GUMMA |
PrefectureName.SAITAMA |
PrefectureName.CHIBA |
PrefectureName.TOKYO |
PrefectureName.KANAGAWA |
PrefectureName.YAMANASHI |
PrefectureName.NAGANO |
PrefectureName.NIIGATA |
PrefectureName.TOYAMA |
PrefectureName.ISHIKAWA |
PrefectureName.FUKUI |
PrefectureName.SHIZUOKA |
PrefectureName.AICHI |
PrefectureName.GIFU |
PrefectureName.MIE |
PrefectureName.SHIGA |
PrefectureName.KYOTO |
PrefectureName.OSAKA |
PrefectureName.HYOGO |
PrefectureName.NARA |
PrefectureName.WAKAYAMA |
PrefectureName.OKAYAMA |
PrefectureName.HIROSHIMA |
PrefectureName.TOTTORI |
PrefectureName.SHIMANE |
PrefectureName.YAMAGUCHI |
PrefectureName.TOKUSHIMA |
PrefectureName.KAGAWA |
PrefectureName.EHIME |
PrefectureName.KOCHI |
PrefectureName.FUKUOKA |
PrefectureName.SAGA |
PrefectureName.NAGASAKI |
PrefectureName.OITA |
PrefectureName.KUMAMOTO |
PrefectureName.MIYAZAKI |
PrefectureName.KAGOSHIMA |
PrefectureName.OKINAWA;

export interface IPrefecture {
  towns: ITown[];
  todofuken_name: PrefectureType;
}
export type PrefectureParams = IPrefecture;

export class Prefecture implements IPrefecture {
  public readonly towns: ITown[];
  public readonly todofuken_name: PrefectureType;
  constructor({
    towns,
    todofuken_name,
  }: PrefectureParams) {
    this.towns = towns;
    this.todofuken_name = todofuken_name;
    Object.freeze(this);
  }
}

export type SpecialPattern = [string, RegExp];

export interface PrefectureDB {
  todofuken_name: string;
  towns: string;
};

export enum OutputFormat {
  JSON = 'json',
  CSV = 'csv',
  GEOJSON = 'geojson',
  TABLE = 'table',
};

export interface GeocodingParams {
  source: string;
  destination: string;
  dataDir: string;
  resourceId: string;
  format: OutputFormat;
  fuzzy: string;
}