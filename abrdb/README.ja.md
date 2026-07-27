# Address Base Registry Database Tools

アドレス・ベース・レジストリをPostgreSQLにインポートするツールです。

## インストール

```bash
make build
./abrdb --help
```

## コマンド

### `abrdb init`

データベーススキーマを初期化し、設定を行います。

```bash
abrdb init [options]
```

オプション:
- `--pref` - 都道府県コード (default: all)。1-47の数値または"all"
- `--category` - データカテゴリ (default: basic)
  - `basic`: 都道府県・市区町村・町字
  - `rsdtdsp`: basic + 住居表示
  - `parcel`: basic + 地番
  - `all`: すべて
- `--pos=true/false` - 座標を有効化（default: false）
- `--force` - 確認プロンプトをスキップ
- `--profile` - 設定プロファイル（default: `default`、[設定プロファイル](#設定プロファイル)参照）

環境変数（フラグより優先度が低い）:
- `ABRDB_PREF` - `--pref` と同等
- `ABRDB_CATEGORY` - `--category` と同等
- `ABRDB_POS` - `--pos` と同等（`true`/`false`）
- `ABRDB_PROFILE` - `--profile` と同等

例:
```bash
# 東京都のみ（basic）
abrdb init --pref 13

# 東京都の住居表示データ
abrdb init --pref 13 --category rsdtdsp

# 全国・全カテゴリ・座標情報付き
abrdb init --pref all --category all --pos
```

### `abrdb import`

データをダウンロードしてインポートします。

```bash
abrdb import [options]
```

オプション:
- `-d, --dry-run` - 実際にはインポートせず、対象を表示
- `-f, --force` - 変更検出をスキップして強制インポート
- `-q, --quiet` - 進捗表示を抑制
- `-v, --verbose` - 詳細なファイル一覧を表示（--dry-run時）

環境変数:
- `ABRDB_DOWNLOAD_DIR` - ダウンロード先ディレクトリ（default: `/tmp/abrdb/data`。Docker イメージは `/tmp/abrdb`、docker-compose は `~/.abrdb/data` を設定済み）
- `ABRDB_FEED_URL` - ABR データフィードの URL（通常は変更不要）

例:
```bash
# 変更確認のみ（インポートなし）
abrdb import --dry-run

# 初回または変更があればインポート（デフォルト動作）
abrdb import

# 強制インポート（変更検出をスキップ）
abrdb import --force
```

### `abrdb show config`

現在の設定を表示します。

```bash
abrdb show config
```

## 設定プロファイル

インポートするカラムのセットを `init --profile <名前>` で選択します。

| プロファイル | 定義 | 説明 |
|----------|------|------|
| `default` | [`config_default.yaml`](internal/schema/config_default.yaml) | 最小限のカラム（abrg用、デフォルト） |
| `full` | [`config_full.yaml`](internal/schema/config_full.yaml) | 全カラム |

プロファイルを変更するには `init` を再実行し、全件取り込みし直します。設定の変わった新しいバイナリで `import` を実行した場合も、同様に `init` のやり直しを求めるエラーになることがあります。

## Docker

abrdb は CLI ツールなので、PostgreSQL のみを常駐させ、abrdb 本体は `docker compose run --rm` で都度実行する構成。

```bash
cp .env.example .env
# .env を編集して DB_PASSWORD を設定

docker compose build
docker compose up -d        # postgres のみが起動 (abrdb は profile=cli で除外)
```

### ワークフロー

```bash
# 1. 初期化
docker compose run --rm abrdb_app init --pref 13 --category basic

# 2. 設定確認
docker compose run --rm abrdb_app show config

# 3. インポート
docker compose run --rm abrdb_app import
```

## 都道府県コード

<details>
<summary>一覧を表示</summary>

| コード | 都道府県 |
|--------|----------|
| 1 | 北海道 |
| 2 | 青森県 |
| 3 | 岩手県 |
| 4 | 宮城県 |
| 5 | 秋田県 |
| 6 | 山形県 |
| 7 | 福島県 |
| 8 | 茨城県 |
| 9 | 栃木県 |
| 10 | 群馬県 |
| 11 | 埼玉県 |
| 12 | 千葉県 |
| 13 | 東京都 |
| 14 | 神奈川県 |
| 15 | 新潟県 |
| 16 | 富山県 |
| 17 | 石川県 |
| 18 | 福井県 |
| 19 | 山梨県 |
| 20 | 長野県 |
| 21 | 岐阜県 |
| 22 | 静岡県 |
| 23 | 愛知県 |
| 24 | 三重県 |
| 25 | 滋賀県 |
| 26 | 京都府 |
| 27 | 大阪府 |
| 28 | 兵庫県 |
| 29 | 奈良県 |
| 30 | 和歌山県 |
| 31 | 鳥取県 |
| 32 | 島根県 |
| 33 | 岡山県 |
| 34 | 広島県 |
| 35 | 山口県 |
| 36 | 徳島県 |
| 37 | 香川県 |
| 38 | 愛媛県 |
| 39 | 高知県 |
| 40 | 福岡県 |
| 41 | 佐賀県 |
| 42 | 長崎県 |
| 43 | 熊本県 |
| 44 | 大分県 |
| 45 | 宮崎県 |
| 46 | 鹿児島県 |
| 47 | 沖縄県 |

</details>
