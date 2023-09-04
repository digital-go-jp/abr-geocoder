import { type } from "node:os";
import { TransformCallback } from "node:stream";
import { Query } from "./query.class";


export interface ICity {
  name: string;
  lg_code: string;
}

export class City implements ICity {
  public readonly name: string;
  public readonly lg_code: string;

  constructor(params: ICity) {
    this.name = params.name;
    this.lg_code = params.lg_code;
    Object.freeze(this);
  }
}
export interface ITown {
  name: string;
  lg_code: string;
  town_id: string;
  koaza: string;
  lat: number;
  lon: number;
  originalName?: string;
  tempAddress?: string;
}

export class Town implements ITown {
  public readonly name: string;
  public readonly lg_code: string;
  public readonly town_id: string;
  public readonly koaza: string;
  public readonly lat: number;
  public readonly lon: number;

  constructor(params: ITown) {
    this.name = params.name;
    this.lg_code = params.lg_code;
    this.town_id = params.town_id;
    this.koaza = params.koaza;
    this.lat = params.lat;
    this.lon = params.lon;
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

export interface IPrefecture {
  cities: ICity[];
  name: PrefectureName;
}
export type PrefectureParams = IPrefecture;

export class Prefecture implements IPrefecture {
  public readonly cities: ICity[];
  public readonly name: PrefectureName;
  constructor({cities, name}: PrefectureParams) {
    this.cities = cities;
    this.name = name;
    Object.freeze(this);
  }
}

export enum OutputFormat {
  JSON = 'json',
  CSV = 'csv',
  GEOJSON = 'geojson',
  TABLE = 'table',
}

export interface GeocodingParams {
  source: string;
  destination: string;
  dataDir: string;
  resourceId: string;
  format: OutputFormat;
  fuzzy?: string;
}

export type InterpolatePattern = {
  regExpPattern: string;
  address: string;
  prefectureName: PrefectureName;
  cityName?: string;
}
export interface INormalizedCity {
  result: string;
}

export interface getNormalizedCityParams {
  address: string,
  prefectureName: PrefectureName,
  cityName: string;
  wildcardHelper: (pattern: string) => string;
}

export type FromStep3Type = {
  query: Query,

  // move to step 4
  callback: TransformCallback,
};

export type Step3aMatchedPatternType = {
  prefecture: PrefectureName;
  city: string;
  input: string;
};

export type FromStep3aType = {
  fromStep3: FromStep3Type;
  matchedPatterns: Step3aMatchedPatternType[];
};
