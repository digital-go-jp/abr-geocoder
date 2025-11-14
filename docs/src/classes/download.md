# Classes: Download / DB

## DownloadProcess（`src/usecases/download/download-process.ts`）

責務:

- DCAT から `.csv.zip` を抽出→グルーピング→ダウンロード→CSV パース→SQLite 取込
- 取込後の辞書生成（各 Finder の `createDictionaryFile`）をトリガ

ポイント:

- LG コードの粒度（都道府県/市区町村）を集約し、競合/偏りを回避するためにシャッフル
- 進捗表示やキャッシュ利用の制御を備える

## CommonDbGeocodeSqlite3（`src/drivers/database/sqlite3/geocode/common-db-geocode-sqlite3.ts`）

責務:

- 地理辞書用のクエリ発行
- 生成 SQL の CRC32 を `get*GeneratorHash()` で提供し、キャッシュの更新判定に利用

主な提供データ:

- 都道府県一覧、郡+市、市+区、京都通り、町字/丁目/小字 など

