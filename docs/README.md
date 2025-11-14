# ABR Geocoder ドキュメント（mdBook）生成手順

ABR Geocoder の内部仕様書は mdBook で管理しています。以下の方法でビルド/プレビューできます。

## 1) Docker を使う（推奨）

前提: Docker Desktop（または互換環境）

- イメージ作成（Mermaid 対応プラグイン込み）
  - `docker build -t abr-mdbook -f docs/Dockerfile .`
- 生成（静的サイトを `docs/book/` に出力）
  - PowerShell: `docker run --rm -v "${PWD}:/work" abr-mdbook`
  - cmd.exe: `docker run --rm -v %CD%:/work abr-mdbook`
  - macOS/Linux(WSL): `docker run --rm -v "$(pwd)":/work abr-mdbook`
- プレビュー（ライブリロード）
  - PowerShell: `docker run --rm -it -p 3000:3000 -v "${PWD}:/work" abr-mdbook serve docs -n 0.0.0.0 -d docs/book`
  - ブラウザ: `http://localhost:3000`

メモ:
- Windows のボリューム指定は PowerShell と cmd で異なります（上記参照）。
- 既にポート 3000 を使用中の場合は、空いているポートに変更してください。

## 2) ローカル環境（Rust/Cargo）で使う

前提: Rust toolchain と Cargo がインストール済み

- ツールのインストール
  - `cargo install --locked mdbook`
  - `cargo install --git https://github.com/badboy/mdbook-mermaid --locked mdbook-mermaid`
- 生成
  - `mdbook build docs -d docs/book`
- プレビュー
  - `mdbook serve docs -n 0.0.0.0 -d docs/book`

## プロジェクト構成（抜粋）

- `docs/book.toml` … mdBook 設定（[book] セクション、Mermaid プリプロセッサ設定済み）
- `docs/src/` … 章ファイル群（`SUMMARY.md` が目次）
- `docs/Dockerfile` … mdBook / mdbook-mermaid を含むビルド用コンテナ
- `docs/book/` … ビルド成果物の出力先（生成後に作成）

## Mermaid について

- 本リポジトリの Dockerfile は `mdbook-mermaid`（公式: https://github.com/badboy/mdbook-mermaid ）を同梱しています。
- ローカル実行時は上記の `cargo install --git ... mdbook-mermaid` を実行してください。
- `docs/book.toml` の Mermaid プリプロセッサ設定が有効である必要があります。

## トラブルシューティング

- legacy book.toml format と出る
  - `docs/book.toml` が新形式（`[book]` セクション）であることを確認してください。
- SUMMARY.md の構文エラー（"link items must only contain a hyperlink"）
  - 子を持つ親項目はリンクである必要があります（例: `- [Architecture](architecture/index.md)`）。
- Mermaid が表示されない
  - `mdbook-mermaid` がインストール済みか、プラグインを含む Docker イメージを使っているか確認してください。
- serve が起動しない/固まる
  - ポート競合やボリューム指定のパス形式（PowerShell と cmd の違い）を確認してください。

## 補足

- 生成物は `docs/book/` に出力されます。静的ホスティングへそのまま配置可能です。
- Mermaid 図の追加は Markdown 内に ```mermaid … ``` で記述してください。

