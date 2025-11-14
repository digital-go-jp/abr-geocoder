# Glossary（用語集）

- ABRG2: 本プロジェクトの辞書バイナリ形式（マジック `abrg` + v2.x）
- Trie（トライ木）: 文字列キーを文字単位で共有する木構造
- HashLinkNode: Trie ノードからデータノードを参照するための連結リスト要素
- DataNode: `next` 連結 + `size` + `hash(FNV-1a 64)` + `gzip(JSON)` 本体
- FNV-1a 64: 64bit のハッシュ手法。ここでは圧縮済みデータに対して適用
- json-stable-stringify: JSON をキー順に並べ、安定化して文字列化する手法
- Shared Memory: `SharedArrayBuffer` ベースの共有メモリ。辞書バッファをワーカーと共有
- LGコード: 自治体コード。`oaza-cho` キャッシュは LG ごとに分割

