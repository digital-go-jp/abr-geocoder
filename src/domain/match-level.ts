export enum MatchLevel {
  // 都道府県も判別できなかった
  UNKNOWN = 0,

  // 都道府県まで判別できた
  PREFECTURE = 1,

  // 市区町村まで判別できた
  ADMINISTRATIVE_AREA = 2,

  // 町字まで判別できた
  TOWN_LOCAL = 3,

  // 住居表示の街区までの判別ができた
  RESIDENTIAL_BLOCK = 7,

  // 住居表示の街区符号・住居番号までの判別ができた
  RESIDENTIAL_DETAIL = 8,
}
