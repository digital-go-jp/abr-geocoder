/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
export class DataField {
  private constructor(
    public csv: string,
    public dbColumn: string
  ) {
    this.csv = this.csv.toLocaleLowerCase();
    this.dbColumn = this.dbColumn.toLocaleLowerCase();
    Object.freeze(this);
  }

  // 共通
  /** @readonly 全国地方公共団体コード */
  static readonly LG_CODE = new DataField('lg_code', 'lg_code');
  /** @readonly 効力発生日 */
  static readonly EFCT_DATE = new DataField('efct_date', 'efct_date');
  /** @readonly 廃止日 */
  static readonly ABLT_DATE = new DataField('ablt_date', 'ablt_date');
  /** @readonly 備考 */
  static readonly REMARKS = new DataField('remarks', 'remarks');

  // 都道府県 (pref)
  /** @readonly 都道府県名 */
  static readonly PREF = new DataField('pref', 'pref');
  /** @readonly 都道府県名_カナ */
  static readonly PREF_KANA = new DataField('pref_kana', 'pref_kana');
  /** @readonly 都道府県名_英字 */
  static readonly PREF_ROMA = new DataField('pref_roma', 'pref_roma');

  // 市区町村 (city)
  /** @readonly 郡名 */
  static readonly COUNTY = new DataField('county', 'county');
  /** @readonly 郡名_カナ */
  static readonly COUNTY_KANA = new DataField('county_kana', 'county_kana');
  /** @readonly 郡名_英字 */
  static readonly COUNTY_ROMA = new DataField('county_roma', 'county_roma');
  /** @readonly 市区町村名 */
  static readonly CITY = new DataField('city', 'city');
  /** @readonly 市区町村名_カナ */
  static readonly CITY_KANA = new DataField('city_kana', 'city_kana');
  /** @readonly 市区町村名_英字 */
  static readonly CITY_ROMA = new DataField('city_roma', 'city_roma');
  /** @readonly 政令市区名 */
  static readonly WARD = new DataField('ward', 'ward');
  /** @readonly 政令市区名_カナ */
  static readonly WARD_KANA = new DataField('ward_kana', 'ward_kana');
  /** @readonly 政令市区名_英字 */
  static readonly WARD_ROMA = new DataField('ward_roma', 'ward_roma');

  // 町字 (town)
  /** @readonly 町字ID */
  static readonly MACHIAZA_ID = new DataField('machiaza_id', 'machiaza_id');
  /** @readonly 町字区分コード */
  static readonly MACHIAZA_TYPE = new DataField(
    'machiaza_type',
    'machiaza_type'
  );
  /** @readonly 大字・町名 */
  static readonly OAZA_CHO = new DataField('oaza_cho', 'oaza_cho');
  /** @readonly 大字・町名_カナ */
  static readonly OAZA_CHO_KANA = new DataField(
    'oaza_cho_kana',
    'oaza_cho_kana'
  );
  /** @readonly 大字・町名_英字 */
  static readonly OAZA_CHO_ROMA = new DataField(
    'oaza_cho_roma',
    'oaza_cho_roma'
  );
  /** @readonly 丁目名 */
  static readonly CHOME = new DataField('chome', 'chome');
  /** @readonly 丁目名_カナ */
  static readonly CHOME_KANA = new DataField('chome_kana', 'chome_kana');
  /** 丁目名_数字 */
  static readonly CHOME_NUMBER = new DataField('chome_number', 'chome_num');
  /** 小字名 */
  static readonly KOAZA = new DataField('koaza', 'koaza');
  /** 小字名_カナ */
  static readonly KOAZA_KANA = new DataField('小字名_カナkoaza_kana', 'koaza_kana');
  /** 小字名_英字 */
  static readonly KOAZA_ROMA = new DataField('koaza_roma', 'koaza_roma');
  /** @readonly 同一町字識別情報 */
  static readonly MACHIAZA_DIST = new DataField(
    'machiaza_dist',
    'machiaza_dist'
  );
  /** @readonly 住居表示フラグ */
  static readonly RSDT_ADDR_FLG = new DataField(
    'rsdt_addr_flg',
    'rsdt_addr_flg'
  );
  /** @readonly 住居表示方式コード */
  static readonly RSDT_ADDR_MTD_CODE = new DataField(
    'rsdt_addr_mtd_code',
    'rsdt_addr_mtd_code'
  );
  /** @readonly 大字・町名_通称フラグ */
  static readonly OAZA_CHO_AKA_FLG = new DataField(
    'oaza_cho_aka_flg',
    'oaza_cho_aka_flg'
  );
  /** @readonly 小字名_通称コード */
  static readonly KOAZA_AKA_CODE = new DataField(
    'koaza_aka_code',
    'koaza_aka_code'
  );
  /** @readonly 大字・町名_電子国土基本図外字 */
  static readonly OAZA_CHO_GSI_UNCMN = new DataField(
    'oaza_cho_gsi_uncmn',
    'oaza_cho_gsi_uncmn'
  );
  /** @readonly 小字名_電子国土基本図外字 */
  static readonly KOAZA_GSI_UNCMN = new DataField(
    'koaza_gsi_uncmn',
    'koaza_gsi_uncmn'
  );
  /** @readonly 状態フラグ */
  static readonly STATUS_FLG = new DataField('status_flg', 'status_flg');
  /** @readonly 起番フラグ */
  static readonly WAKE_NUM_FLG = new DataField('wake_num_flg', 'wake_num_flg');
  /** @readonly 原典資料コード */
  static readonly SRC_CODE = new DataField('src_code', 'src_code');
  /** @readonly 郵便番号 */
  static readonly POST_CODE = new DataField('post_code', 'post_code');

  // 地番
  /** @readonly 地番ID */
  static readonly PRC_ID = new DataField('prc_id', 'prc_id');
  /** @readonly 地番1 */
  static readonly PRC_NUM1 = new DataField('prc_num1', 'prc_num1');
  /** @readonly 地番2 */
  static readonly PRC_NUM2 = new DataField('prc_num2', 'prc_num2');
  /** @readonly 地番3 */
  static readonly PRC_NUM3 = new DataField('prc_num3', 'prc_num3');
  /** @readonly 地番レコード区分フラグ */
  static readonly PRC_REC_FLG = new DataField('prc_rec_flg', 'prc_rec_flg');
  /** @readonly 地番区域コード */
  static readonly PRC_AREA_CODE = new DataField(
    'prc_area_code',
    'prc_area_code'
  );
  /** @readonly 不動産番号 */
  static readonly REAL_PROP_NUM = new DataField(
    'real_prop_num',
    'real_prop_num'
  );

  // 住居表示-街区
  /** @readonly 街区ID */
  static readonly BLK_ID = new DataField('blk_id', 'blk_id');
  /** @readonly 街区符号 */
  static readonly BLK_NUM = new DataField('blk_num', 'blk_num');

  // 住居表示-住居
  /** @readonly 住居ID */
  static readonly RSDT_ID = new DataField('rsdt_id', 'rsdt_id');
  /** @readonly 住居2ID */
  static readonly RSDT2_ID = new DataField('rsdt2_id', 'rsdt2_id');
  /** @readonly 住居番号 */
  static readonly RSDT_NUM = new DataField('rsdt_num', 'rsdt_num');
  /** @readonly 住居番号2 */
  static readonly RSDT_NUM2 = new DataField('rsdt_num2', 'rsdt_num2');
  /** @readonly 基礎番号・住居番号区分 */
  static readonly BASIC_RSDT_DIV = new DataField(
    'basic_rsdt_div',
    'basic_rsdt_div'
  );

  // 位置参照
  /** @readonly 代表点_経度 */
  static readonly REP_LON = new DataField('rep_lon', 'rep_lon');
  /** @readonly 代表点_緯度 */
  static readonly REP_LAT = new DataField('rep_lat', 'rep_lat');
  /** @readonly 代表点_座標参照系 */
  static readonly REP_SRID = new DataField('rep_srid', 'rep_srid');

  // データセットメタデータ (dataset_metadata)
  /** @readonly データセット管理ID */
  static readonly DATASET_ID = new DataField('dataset_id', 'dataset_id');
  /** @readonly エンティティタグ */
  static readonly ETAG = new DataField('etag', 'etag');
  /** @readonly データサイズ */
  static readonly CONTENT_LENGTH = new DataField(
    'content_length',
    'content_length'
  );
  /** 最終更新日時 */
  static readonly LAST_MODIFY = new DataField('last_modified', 'last_modified');
  /** ファイルURL */
  static readonly FILE_URL = new DataField('file_url', 'file_url');
}
