# Columns 役割（主要カラムの意味）

この節では、テーブルごとのカラムの意味を簡潔にまとめます。型は実装上 `TEXT/INTEGER` が中心です（座標など数値文字列も含む）。主キー（*_key）は `TableKeyProvider` により LGコード等から安定的に導出されます。

## 共通・メタ

- `lg_code` 全国地方公共団体コード（都道府県/市区町村を一意に表す6桁プレフィックス）
- `efct_date` 効力発生日（データの有効化日）
- `ablt_date` 廃止日（データの失効日）
- `remarks` 備考

座標系/位置参照
- `rep_lat`, `rep_lon` 代表点（緯度/経度）
- `rep_srid` 代表点の座標参照系（SRID）

データセットメタ
- `url_key` URLキャッシュ用のキー（ハッシュ）
- `etag` HTTP ETag
- `content_length` コンテンツサイズ
- `last_modified` 最終更新日時
- `url` ダウンロード元 URL
- `crc32` レコードの内容に対する CRC32（更新検知/整合性用）

## PREF（都道府県）

キー
- `pref_key` 都道府県の内部キー（導出）

属性
- `pref` 都道府県名（例: 東京都）
- `pref_kana` 都道府県名（カナ）
- `pref_roma` 都道府県名（ローマ字）
- `lg_code` 全国地方公共団体コード（都道府県桁）
- `rep_lat`, `rep_lon` 都道府県代表点

## CITY（郡・市・区）

キー/外部参照
- `city_key` 市区の内部キー（導出）
- `pref_key` 所属都道府県のキー（外部参照）

属性
- `lg_code` 市区町村の LGコード
- `county` 郡名（例: 〇〇郡）
- `county_kana`, `county_roma` 郡名（カナ/ローマ字）
- `city` 市区町村名（例: 千代田区）
- `city_kana`, `city_roma` 市区町村名（カナ/ローマ字）
- `ward` 政令市の区名（該当時）
- `ward_kana`, `ward_roma` 区名（カナ/ローマ字）
- `rep_lat`, `rep_lon` 市区の代表点

## TOWN（町字・丁目・小字）

キー/外部参照
- `town_key` 町字の内部キー（導出）
- `city_key` 所属市区のキー（外部参照）

属性（名称）
- `machiaza_id` 町字ID（地区コード）
- `machiaza_type` 町字区分コード
- `oaza_cho` 大字・町名（例: 霞が関）
- `oaza_cho_kana`, `oaza_cho_roma` 大字・町名（カナ/ローマ字）
- `chome` 丁目名（例: 1丁目 → 正規化後は数値化されることがある）
- `chome_kana` 丁目名（カナ）
- `chome_num` 丁目の数値表現
- `koaza` 小字名
- `koaza_kana`, `koaza_roma` 小字名（カナ/ローマ字）
- `machiaza_dist` 同一町字識別（同名の区別情報）

属性（フラグ/識別/郵便）
- `rsdt_addr_flg` 住居表示フラグ（1: 住居表示、0: 地番）
- `rsdt_addr_mtd_code` 住居表示方式コード
- `oaza_cho_aka_flg` 大字・町名の通称フラグ
- `koaza_aka_code` 小字名の通称コード（例: 京都の通称通り名で特別扱い）
- `oaza_cho_gsi_uncmn`, `koaza_gsi_uncmn` 電子国土基本図の外字
- `status_flg` 状態フラグ（現/廃等）
- `wake_num_flg` 起番（番号振り開始）フラグ
- `src_code` 原典資料コード
- `post_code` 郵便番号

座標
- `rep_lat`, `rep_lon` 町字代表点（欠落時は上位で補完する場合あり）

## RSDT_BLK（住居表示-街区）

キー/外部参照
- `rsdtblk_key` 街区キー（導出）
- `town_key` 所属町字のキー（外部参照）

属性
- `blk_id` 街区ID
- `blk_num` 街区符号
- `rep_lat`, `rep_lon` 街区代表点

## RSDT_DSP（住居表示-住居番号）

キー/外部参照
- `rsdtdsp_key` 住居番号キー（導出）
- `rsdtblk_key` 所属街区のキー（外部参照）

属性
- `rsdt_id` 住居ID（基礎番号）
- `rsdt2_id` 住居2ID（枝番等）
- `rsdt_num` 住居番号（数値化投影）
- `rsdt_num2` 住居番号2（数値化投影）
- `basic_rsdt_div` 基礎番号・住居番号区分
- `rep_lat`, `rep_lon` 住居代表点

## PARCEL（地番）

キー/外部参照
- `parcel_key` 地番キー（導出）
- `town_key` 所属町字のキー（外部参照/NULL許容）

属性
- `prc_id` 地番ID
- `prc_num1`, `prc_num2`, `prc_num3` 地番の構成要素
- `prc_rec_flg` 地番レコード区分フラグ
- `prc_area_code` 地番区域コード
- `real_prop_num` 不動産番号
- `rep_lat`, `rep_lon` 地番代表点（posデータから注入）

## DATASET（ダウンロード/更新用メタ）

- `url_key` URLハッシュ（主キー）
- `url` 取得対象のURL
- `etag` ETag（If-None-Match に使用）
- `content_length` コンテンツサイズ
- `last_modified` 最終更新日時（If-Modified-Since 等に対応）
- `crc32` ローカル算出の CRC32（キャッシュ検証）

---

補足:
- 実テーブルでは `crc32` カラムは pref/city/town/rsdt_blk/rsdt_dsp/parcel に配置され、CSV取り込み時の変更検出・重複挿入抑止に用いられます。
- 代表点は `*_pos` 系CSVにより後補されることがあり、ON CONFLICT UPDATE で差分のみ更新します。
