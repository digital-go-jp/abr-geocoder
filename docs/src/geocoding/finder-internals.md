# Finder Internals（TrieAddressFinder2）

目的:

- メモリ上の ABRG2 バッファを読み取り、部分一致やワイルドカードを含む探索で候補集合を抽出

入力:

- `CharNode` 連結（正規化済み文字列を1文字単位で持つ、原文文字も保存）
- オプション: `fuzzy`（1文字のワイルドカード）, `extraChallenges`（前置語の補助探索）, `partialMatches`

探索アルゴリズム（概要）:

1) ルート（空文字）から開始。探索キューに状態（一致数/曖昧数/現在オフセット/パス/部分一致）を積む
2) 現在ノードの `name` とターゲット文字を比較
   - 完全一致 → `child` に進む
   - 不一致 → `sibling` に進む
   - `fuzzy` が一致する場合は、 sibling 分岐も追加（曖昧カウント加算）
   - `extraChallenges` は前置語が合致した場合に別キューとして探索を追加
3) 途中ノードに `hashValueList` があれば部分一致候補として保持
4) 終端または子が無い場合、候補集合へ追加
5) すべてのキューを処理後、候補集合を返却

数値・表記の扱い:

- `isKanjiNums`/`isDigit`/`toHankakuAlphaNum` により、漢数字と算用数字の同一視を行う
- ノード名/入力文字を数値同士に正規化して比較（`trie-finder2.ts` 参照）

データ復元:

- 候補ごとに `hashValueList` を辿り `readDataNode()` で DataNode 連結を読み出し、解凍(JSON) → `info` として返す

出力:

- `info`（辞書行の JSON）と `unmatched`（未消化の CharNode）、`depth`（一致深さ）、`ambiguousCnt`（曖昧一致回数）、`path`（一致パス）

