# Utilities（抜粋）

- `reg-exp-ex.ts` 正規表現ユーティリティ（タグ式置換、命名グループ対応の使い勝手改善）
- `crc32-lib.ts` CRC32（ファイル/バッファ/文字列/レコード）
- `make-dir-if-not-exists.ts` フォルダ作成
- `remove-files.ts` パターン指定の削除（古いキャッシュ掃除）
- `resolve-home.ts` `~` 展開
- `thread/semaphore-manager.ts` 簡易セマフォ（Writer 内での排他）
- `thread/shared-memory.ts` Buffer と SharedArrayBuffer の変換
- `logger/debug-logger.ts` デバッグ出力（`debug` モードのみ）
- `transformations/*` 行/コメントフィルタやカウンタなどストリーム補助

表記変換（ジオコーディング前処理）:

- 漢数字→算用数字、半角化、仮名変換、旧字→新字等（`toHankakuAlphaNum`, `toHiragana`, `jisKanji`, `kan2num`）

