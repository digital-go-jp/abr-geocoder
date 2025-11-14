# Operations（運用）

## キャッシュ再生成

- SQL を変更した場合は自動で `<hash>` が変わり、古いキャッシュは `removeFiles()` で掃除されます
- 手動再生成を行う場合:
  - 各 Finder の `createDictionaryFile(task)` を呼ぶ、または
  - AbrGeocoder の初期化時に `loadDataFile()` がなければ自動生成

## バージョン互換性

- ABRG2 のヘッダー `version` は `2.2` 以上を想定。古い/新しいフォーマットは読み込み失敗で再生成
- 破損（magic 不一致/size 異常）はファイル削除→再生成

## 共有メモリ

- 大きな辞書はワーカーにコピーせず共有（起動時に一度だけマップ）。Node のメモリ制限に注意

## 検証

- 先頭 100B でヘッダ検査する簡易チェックを各 Finder の `loadDataFile()` が実施
- さらに `TrieAddressFinder2` を試作成して整合性を確認（例外時は再生成）

