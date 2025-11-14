# Classes: Trie / Writer / Finder

## FileTrieWriter（`src/usecases/geocode/models/trie/file-trie-writer.ts`）

責務:

- ABRG2 ファイルの生成・追記・ヘッダー更新・重複排除
- トライ木ノード/ハッシュ連結/データノードの整合性管理

主なメソッド:

- `static create(path)` ヘッダー検証→再利用 or 新規初期化（ルート作成）
- `writeHeader(header?)` マジック/ヘッダー/エントリポイントを更新
- `addNode({key, value})` キーを1文字ずつ辿ってノード挿入・`appendHashOffset`
- `writeTrieNode({trieNode, hashValueOffset?})` ノードの固定部+名前を書込み
- `appendHashOffset({trieNode, hashValueOffset})` ノードのハッシュ連結末尾に追記
- `storeData(value)` JSON→gzip→FNV-1a64 計算→重複/衝突処理
- `close()` バッファフラッシュと FD クローズ

実装上のポイント:

- 内部 8MB バッファで追記を集約。前方の小さな書換（子/兄弟オフセット）は直接書込
- 重複判定は「圧縮後バイト列の完全一致」で実施（衝突時は連結を辿る）
- 1ファイル内に `{}` を持つルートデータ（hash=0）を保存し、空文字の TrieRoot に紐付け

## TrieTreeBuilderBase（`src/usecases/geocode/models/trie/trie-tree-builder-base.ts`）

責務:

- 低レベル I/O（バッファ読書き/整数読取/ヘッダー解釈/ノード復元）

主なメソッド:

- `readHeader()` マジック/バージョン/エントリポイントを検証
- `readTrieNode(offset)` 固定部+文字列を復元し、`hash_list` を `createHashValueList()` で構築
- `readDataNode(offset, expect?)` データノード連結を復元
- `write(buf, pos)`/`read(pos, size)` 大域バッファ越しの I/O

## TrieAddressFinder2（`src/usecases/geocode/models/trie/trie-finder2.ts`）

責務:

- メモリ上の ABRG2 から Trie を辿り、候補（DataNode 連結）を復元

主なメソッド:

- `find({target, fuzzy, partialMatches, extraChallenges})` 候補リストを返却
- `readDataNode(offset)` 解凍して JSON 復元（衝突連結を再帰で辿る）
- `createHashValueList(nodeOffset)` ノードのハッシュ連結を復元

