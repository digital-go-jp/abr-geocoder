# Cache Overview（辞書キャッシュ）

生成対象（ファイル名の例）とスコープ:

- `pref_<hash>.abrg2`: 都道府県一覧（全国, 単一ファイル）
- `county-and-city_<hash>.abrg2`: 郡+市（全国, 単一）
- `city-and-ward_<hash>.abrg2`: 市+区（全国, 単一）
- `kyoto-street_<hash>.abrg2`: 京都の通り名（全国, 単一）
- `oaza-cho_<hash>_<LG>.abrg2`: 大字+丁目+小字（自治体別, LGコードごと）
- `ward_<hash>.abrg2`: 区（全国, 単一）
- `tokyo23-ward_<hash>.abrg2`, `tokyo23-town_<hash>.abrg2`: 東京23区系

ここで `<hash>` は各 SQL 生成式に対する CRC32（`get*GeneratorHash()`）で、SQL 改変時にキャッシュを作り直すトリガとして機能します。

作成手順（各 Finder の `createDictionaryFile`）:

1) 旧ファイルをパターン削除（`removeFiles()`）
2) SQLite から行を取得
3) 正規化（仮名/漢数字/記号 等）
4) `FileTrieWriter.addNode(key, value)` を反復
5) `close()` でフラッシュ

読み込み手順（各 Finder の `loadDataFile`）:

1) キャッシュ存在時は先頭100Bを検査 → ヘッダー検証が通れば採用
2) 無ければ `createDictionaryFile()` 実行
3) 読み出した Buffer を Shared Memory 化してワーカーに共有

