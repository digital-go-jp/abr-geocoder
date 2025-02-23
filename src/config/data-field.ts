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
    public dbColumn: string,
  ) {
    this.csv = this.csv.toLocaleLowerCase();
    this.dbColumn = this.dbColumn.toLocaleLowerCase();
    Object.freeze(this);
  }

  // 共通
  /** 全国地方公共団体コード */
  static readonly LG_CODE = new DataField('lg_code', 'lg_code');
  /** 効力発生日 */
  static readonly EFCT_DATE = new DataField('efct_date', 'efct_date');
  /** 廃止日 */
  static readonly ABLT_DATE = new DataField('ablt_date', 'ablt_date');
  /** 備考 */
  static readonly REMARKS = new DataField('remarks', 'remarks');

  // 都道府県 (pref)
  /** 都道府県名 */
  static readonly PREF = new DataField('pref', 'pref');
  /** 都道府県名_カナ */
  static readonly PREF_KANA = new DataField('pref_kana', 'pref_kana');
  /** 都道府県名_英字 */
  static readonly PREF_ROMA = new DataField('pref_roma', 'pref_roma');

  // 市区町村 (city)
  /** 郡名 */
  static readonly COUNTY = new DataField('county', 'county');
  /** 郡名_カナ */
  static readonly COUNTY_KANA = new DataField('county_kana', 'county_kana');
  /** 郡名_英字 */
  static readonly COUNTY_ROMA = new DataField('county_roma', 'county_roma');
  /** 市区町村名 */
  static readonly CITY = new DataField('city', 'city');
  /** 市区町村名_カナ */
  static readonly CITY_KANA = new DataField('city_kana', 'city_kana');
  /** 市区町村名_英字 */
  static readonly CITY_ROMA = new DataField('city_roma', 'city_roma');
  /** 政令市区名 */
  static readonly WARD = new DataField('ward', 'ward');
  /** 政令市区名_カナ */
  static readonly WARD_KANA = new DataField('ward_kana', 'ward_kana');
  /** 政令市区名_英字 */
  static readonly WARD_ROMA = new DataField('ward_roma', 'ward_roma');

  // 町字 (town)
  /** 町字ID */
  static readonly MACHIAZA_ID = new DataField('machiaza_id', 'machiaza_id');
  /** 町字区分コード */
  static readonly MACHIAZA_TYPE = new DataField(
    'machiaza_type',
    'machiaza_type',
  );
  /** 大字・町名 */
  static readonly OAZA_CHO = new DataField('oaza_cho', 'oaza_cho');
  /** 大字・町名_カナ */
  static readonly OAZA_CHO_KANA = new DataField(
    'oaza_cho_kana',
    'oaza_cho_kana',
  );
  /** 大字・町名_英字 */
  static readonly OAZA_CHO_ROMA = new DataField(
    'oaza_cho_roma',
    'oaza_cho_roma',
  );
  /** 丁目名 */
  static readonly CHOME = new DataField('chome', 'chome');
  /** 丁目名_カナ */
  static readonly CHOME_KANA = new DataField('chome_kana', 'chome_kana');
  /** 丁目名_数字 */
  static readonly CHOME_NUMBER = new DataField('chome_number', 'chome_num');
  /** 小字名 */
  static readonly KOAZA = new DataField('koaza', 'koaza');
  /** 小字名_カナ */
  static readonly KOAZA_KANA = new DataField('小字名_カナkoaza_kana', 'koaza_kana');
  /** 小字名_英字 */
  static readonly KOAZA_ROMA = new DataField('koaza_roma', 'koaza_roma');
  /** 同一町字識別情報 */
  static readonly MACHIAZA_DIST = new DataField(
    'machiaza_dist',
    'machiaza_dist',
  );
  /** 住居表示フラグ */
  static readonly RSDT_ADDR_FLG = new DataField(
    'rsdt_addr_flg',
    'rsdt_addr_flg',
  );
  /** 住居表示方式コード */
  static readonly RSDT_ADDR_MTD_CODE = new DataField(
    'rsdt_addr_mtd_code',
    'rsdt_addr_mtd_code',
  );
  /** 大字・町名_通称フラグ */
  static readonly OAZA_CHO_AKA_FLG = new DataField(
    'oaza_cho_aka_flg',
    'oaza_cho_aka_flg',
  );
  /** 小字名_通称コード */
  static readonly KOAZA_AKA_CODE = new DataField(
    'koaza_aka_code',
    'koaza_aka_code',
  );
  /** 大字・町名_電子国土基本図外字 */
  static readonly OAZA_CHO_GSI_UNCMN = new DataField(
    'oaza_cho_gsi_uncmn',
    'oaza_cho_gsi_uncmn',
  );
  /** 小字名_電子国土基本図外字 */
  static readonly KOAZA_GSI_UNCMN = new DataField(
    'koaza_gsi_uncmn',
    'koaza_gsi_uncmn',
  );
  /** 状態フラグ */
  static readonly STATUS_FLG = new DataField('status_flg', 'status_flg');
  /** 起番フラグ */
  static readonly WAKE_NUM_FLG = new DataField('wake_num_flg', 'wake_num_flg');
  /** 原典資料コード */
  static readonly SRC_CODE = new DataField('src_code', 'src_code');
  /** 郵便番号 */
  static readonly POST_CODE = new DataField('post_code', 'post_code');

  // 地番
  /** 地番ID */
  static readonly PRC_ID = new DataField('prc_id', 'prc_id');
  /** 地番1 */
  static readonly PRC_NUM1 = new DataField('prc_num1', 'prc_num1');
  /** 地番2 */
  static readonly PRC_NUM2 = new DataField('prc_num2', 'prc_num2');
  /** 地番3 */
  static readonly PRC_NUM3 = new DataField('prc_num3', 'prc_num3');
  /** 地番レコード区分フラグ */
  static readonly PRC_REC_FLG = new DataField('prc_rec_flg', 'prc_rec_flg');
  /** 地番区域コード */
  static readonly PRC_AREA_CODE = new DataField(
    'prc_area_code',
    'prc_area_code',
  );
  /** 不動産番号 */
  static readonly REAL_PROP_NUM = new DataField(
    'real_prop_num',
    'real_prop_num',
  );

  // 住居表示-街区
  /** 街区ID */
  static readonly BLK_ID = new DataField('blk_id', 'blk_id');
  /** 街区符号 */
  static readonly BLK_NUM = new DataField('blk_num', 'blk_num');

  // 住居表示-住居
  /** 住居ID */
  static readonly RSDT_ID = new DataField('rsdt_id', 'rsdt_id');
  /** 住居2ID */
  static readonly RSDT2_ID = new DataField('rsdt2_id', 'rsdt2_id');
  /** 住居番号 */
  static readonly RSDT_NUM = new DataField('rsdt_num', 'rsdt_num');
  /** 住居番号2 */
  static readonly RSDT_NUM2 = new DataField('rsdt_num2', 'rsdt_num2');
  /** 基礎番号・住居番号区分 */
  static readonly BASIC_RSDT_DIV = new DataField(
    'basic_rsdt_div',
    'basic_rsdt_div',
  );

  // 位置参照
  /** 代表点_経度 */
  static readonly REP_LON = new DataField('rep_lon', 'rep_lon');
  /** 代表点_緯度 */
  static readonly REP_LAT = new DataField('rep_lat', 'rep_lat');
  /** 代表点_座標参照系 */
  static readonly REP_SRID = new DataField('rep_srid', 'rep_srid');

  // データセットメタデータ 
  /** URLキャッシュのハッシュ値 */
  static readonly URL_KEY = new DataField('url_key', 'url_key');
  /** エンティティタグ */
  static readonly ETAG = new DataField('etag', 'etag');
  /** データサイズ */
  static readonly CONTENT_LENGTH = new DataField(
    'content_length',
    'content_length',
  );
  /** 最終更新日時 */
  static readonly LAST_MODIFIED = new DataField('last_modified', 'last_modified');
  /** ファイルURL */
  static readonly FILE_URL = new DataField('url', 'url');
  /** CRC32(zipファイル用) */
  static readonly CRC32 = new DataField('crc32', 'crc32');
}
