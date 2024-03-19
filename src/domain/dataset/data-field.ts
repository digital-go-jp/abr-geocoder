/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
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

  static readonly ABLT_DATE = new DataField('ablt_date', 'ablt_date');
  static readonly ADDR_ID = new DataField('rsdt_id', 'addr_id');
  static readonly ADDR2_ID = new DataField('rsdt2_id', 'addr2_id');
  static readonly BASIC_RSDT_DIV = new DataField(
    'basic_rsdt_div',
    'basic_rsdt_div'
  );
  static readonly BLK_ID = new DataField('blk_id', 'blk_id');
  static readonly BLK_NUM = new DataField('blk_num', 'blk_num');
  static readonly CHOME_NAME = new DataField('chome', 'chome_name');
  static readonly CHOME_NAME_KANA = new DataField(
    'chome_kana',
    'chome_name_kana'
  );
  static readonly CHOME_NAME_NUMBER = new DataField(
    'chome_number',
    'chome_name_number'
  );
  static readonly CITY_NAME = new DataField('city', 'city_name');
  static readonly CITY_NAME_KANA = new DataField('city_kana', 'city_name_kana');
  static readonly CITY_NAME_ROMA = new DataField('city_roma', 'city_name_roma');

  static readonly COUNTY_NAME = new DataField('county', 'county_name');
  static readonly COUNTY_NAME_KANA = new DataField(
    'county_kana',
    'county_name_kana'
  );
  static readonly COUNTY_NAME_ROMA = new DataField(
    'county_roma',
    'county_name_roma'
  );
  static readonly EFCT_DATE = new DataField('efct_date', 'efct_date');
  static readonly KOAZA_ALT_NAME_FLG = new DataField(
    'koaza_cho_aka_flg',
    'koaza_alt_name_flg'
  );
  static readonly KOAZA_FRN_LTRS_FLG = new DataField(
    'koaza_gsi_uncmn',
    'koaza_frn_ltrs_flg'
  );
  static readonly KOAZA_NAME = new DataField('koaza', 'koaza_name');
  static readonly KOAZA_NAME_KANA = new DataField(
    'koaza_kana',
    'koaza_name_kana'
  );
  static readonly KOAZA_NAME_ROMA = new DataField(
    'koaza_roma',
    'koaza_name_roma'
  );

  static readonly LG_CODE = new DataField('lg_code', 'lg_code');

  static readonly OAZA_FRN_LTRS_FLG = new DataField(
    'oaza_cho_gsi_uncmn',
    'oaza_frn_ltrs_flg'
  );
  static readonly OAZA_TOWN_ALT_NAME_FLG = new DataField(
    'oaza_cho_aka_flg',
    'oaza_town_alt_name_flg'
  );
  static readonly OAZA_TOWN_NAME = new DataField('oaza_cho', 'oaza_town_name');
  static readonly OAZA_TOWN_NAME_KANA = new DataField(
    'oaza_cho_kana',
    'oaza_town_name_kana'
  );
  static readonly OAZA_TOWN_NAME_ROMA = new DataField(
    'oaza_cho_roma',
    'oaza_town_name_roma'
  );
  static readonly OD_CITY_NAME = new DataField('ward', 'od_city_name');
  static readonly OD_CITY_NAME_KANA = new DataField(
    'ward_kana',
    'od_city_name_kana'
  );
  static readonly OD_CITY_NAME_ROMA = new DataField(
    'ward_roma',
    'od_city_name_roma'
  );
  static readonly POST_CODE = new DataField('post_code', 'post_code');
  static readonly PREF_NAME = new DataField('pref', 'pref_name');
  static readonly PREF_NAME_KANA = new DataField('pref_kana', 'pref_name_kana');
  static readonly PREF_NAME_ROMA = new DataField('pref_roma', 'pref_name_roma');
  static readonly REMARKS = new DataField('remarks', 'remarks');
  static readonly REP_PNT_LAT = new DataField('rep_lat', 'rep_pnt_lat');
  static readonly REP_PNT_LON = new DataField('rep_lon', 'rep_pnt_lon');
  static readonly RSDT_ADDR_FLG = new DataField(
    'rsdt_addr_flg',
    'rsdt_addr_flg'
  );
  static readonly RSDT_ADDR_MTD_CODE = new DataField(
    'rsdt_addr_mtd_code',
    'rsdt_addr_mtd_code'
  );
  static readonly RSDT_NUM = new DataField('rsdt_num', 'rsdt_num');
  static readonly RSDT_NUM2 = new DataField('rsdt_num2', 'rsdt_num2');
  static readonly SRC_CODE = new DataField('src_code', 'src_code');
  static readonly STATUS_FLG = new DataField('status_flg', 'status_flg');
  static readonly TOWN_CODE = new DataField('machiaza_type', 'town_code');
  static readonly TOWN_ID = new DataField('machiaza_id', 'town_id');
  static readonly WAKE_NUM_FLG = new DataField('wake_num_flg', 'wake_num_flg');
  static readonly REP_PNT_SRID = new DataField('rep_srid', 'rep_pnt_srid');

  // static toDataField(csvFieldName: string): DataField {
  //   const jpnToEn: Record<string, DataField> = {
  //     廃止日: DataField.ABLT_DATE,
  //     住居ID: DataField.ADDR_ID,
  //     住居2ID: DataField.ADDR2_ID,
  //     '基礎番号・住居番号区分': DataField.BASIC_RSDT_DIV,
  //     街区ID: DataField.BLK_ID,
  //     街区符号: DataField.BLK_NUM,
  //     丁目名: DataField.CHOME_NAME,
  //     丁目名_カナ: DataField.CHOME_NAME_KANA,
  //     丁目名_数字: DataField.CHOME_NAME_NUMBER,
  //     市区町村名: DataField.CITY_NAME,
  //     市区町村名_カナ: DataField.CITY_NAME_KANA,
  //     市区町村名_英字: DataField.CITY_NAME_ROMA,
  //     郡名: DataField.COUNTY_NAME,
  //     郡名_カナ: DataField.COUNTY_NAME_KANA,
  //     郡名_英字: DataField.COUNTY_NAME_ROMA,
  //     効力発生日: DataField.EFCT_DATE,
  //     小字名_通称フラグ: DataField.KOAZA_ALT_NAME_FLG,
  //     小字名_電子国土基本図外字: DataField.KOAZA_FRN_LTRS_FLG,
  //     小字名: DataField.KOAZA_NAME,
  //     小字名_カナ: DataField.KOAZA_NAME_KANA,
  //     小字名_英字: DataField.KOAZA_NAME_ROMA,
  //     全国地方公共団体コード: DataField.LG_CODE,
  //     '大字・町名_電子国土基本図外字': DataField.OAZA_FRN_LTRS_FLG,
  //     '大字・町名_通称フラグ': DataField.OAZA_TOWN_ALT_NAME_FLG,
  //     '大字・町名': DataField.OAZA_TOWN_NAME,
  //     '大字・町名_カナ': DataField.OAZA_TOWN_NAME_KANA,
  //     '大字・町名_英字': DataField.OAZA_TOWN_NAME_ROMA,
  //     政令市区名: DataField.OD_CITY_NAME,
  //     政令市区名_カナ: DataField.OD_CITY_NAME_KANA,
  //     政令市区名_英字: DataField.OD_CITY_NAME_ROMA,
  //     郵便番号: DataField.POST_CODE,
  //     都道府県名: DataField.PREF_NAME,
  //     都道府県名_カナ: DataField.PREF_NAME_KANA,
  //     都道府県名_英字: DataField.PREF_NAME_ROMA,
  //     備考: DataField.REMARKS,
  //     代表点_緯度: DataField.REP_PNT_LAT,
  //     代表点_経度: DataField.REP_PNT_LON,
  //     住居表示フラグ: DataField.RSDT_ADDR_FLG,
  //     住居表示方式コード: DataField.RSDT_ADDR_MTD_CODE,
  //     住居番号: DataField.RSDT_NUM,
  //     住居番号2: DataField.RSDT_NUM2,
  //     原典資料コード: DataField.SRC_CODE,
  //     状態フラグ: DataField.STATUS_FLG,
  //     町字区分コード: DataField.TOWN_CODE,
  //     町字ID: DataField.TOWN_ID,
  //     起番フラグ: DataField.WAKE_NUM_FLG,
  //     代表点_座標参照系: DataField.REP_PNT_SRID,
  //     代表点_地図情報レベル: DataField.REP_PNT_SRID,
  //   };

  //   csvFieldName = csvFieldName.toLowerCase();
  //   if (!(csvFieldName in jpnToEn)) {
  //     throw new Error(`'${csvFieldName}' is unknown field name.`);
  //   }
  //   return jpnToEn[csvFieldName];
  // }
}
