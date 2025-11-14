# Database

この章では、コードから読み取れる SQLite スキーマをまとめ、ER 図と主要テーブルの関係、主キーの生成方法（TableKeyProvider）を説明します。

- Schema / ER 図: 主要テーブル（pref/city/town/rsdt_blk/rsdt_dsp/parcel/dataset）とリレーション
- キー生成: `pref_key/city_key/town_key/rsdtblk_key/rsdtdsp_key/parcel_key` の導出
- 代表的なクエリ: ジオコーディングで参照する結合とフィルタ

