# Classes: DB（Geocode 用）

## CommonDbGeocodeSqlite3

責務:

- SQLite（better-sqlite3）経由で辞書生成に必要な行集合を返す
- 生成 SQL の CRC32 を提供（キャッシュ再生成のトリガ）

主なメソッド（例）:

- `getPrefList()` 都道府県一覧
- `getCityAndWardList()` 市+区
- `getKyotoStreetRows()` 京都の通り（町字と代表点の補正ロジック含む）
- `getOazaChomes({ lg_code })` 町字/丁目/小字（自治体ごと）
- `get*GeneratorHash()` 各 SQL の CRC32

備考:

- 代表点欠落の補完や LG 依存の条件付け等、辞書品質のための前処理を実装

