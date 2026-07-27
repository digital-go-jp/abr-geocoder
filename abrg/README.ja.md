# Address Base Registry Geocoder

アドレス・ベース・レジストリを利用したジオコーダーです。

## 前提条件

事前に [abrdb](../abrdb/README.ja.md) でPostgreSQLにデータをインポートしてください。

## インストール

```bash
make build
./abrg --help
```

## キャッシュ管理

APIサーバー・CLIツールの両方で使用するDuckDBキャッシュを管理します。

### `abrg cache build`

PostgreSQLからDuckDBキャッシュファイルを構築します。

```bash
./abrg cache build
```

キャッシュにはスキーマ版が記録され、起動時にバイナリの要求する版と照合します。バイナリ更新後にスキーマ版のエラーが出た場合は `cache build` で再構築してください。住居表示 (cache_rsdtdsp)・地番 (cache_parcel) のテーブルは enabled_category に含まれるカテゴリの分だけ作られます。

環境変数:
- `ABRG_CACHE_MEMORY_LIMIT` - 構築時の DuckDB メモリ上限（default: `8GB`。`16GB`、`512MiB` のような形式）

### `abrg cache info`

キャッシュファイルの情報を表示します。

```bash
./abrg cache info
```

## APIサーバー

### `abrg serve`

APIサーバーを起動します。事前に `cache build` が必要です。

```bash
./abrg serve
```

エンドポイント:

| エンドポイント | 説明 |
|---------------|------|
| `/normalize` | 住所正規化（表記揺れの統一、ABRデータと照合なし） |
| `/match` | 住所マッチング（ABRデータと照合） |
| `/geocode` | ジオコーディング（住所->座標） |
| `/reverse` | 逆ジオコーディング（座標->住所）※実験的API |
| `/health` | ヘルスチェック |

API仕様: [openapi/openapi.yml](openapi/openapi.yml)

### 環境変数

| 変数名 | デフォルト | 説明 |
|--------|----------|------|
| `PORT` | `3000` | サーバーポート |
| `CACHE_PATH` | `~/.abrg/cache/abrg.duckdb` | DuckDBキャッシュファイルのパス |
| `ABRG_DUCKDB_THREADS` | `2` | DuckDBのクエリ内並列数の上限（`0` でDuckDB既定＝コア数） |
| `CORS_ALLOW_ORIGIN` | `*` | CORS許可オリジン。カンマ区切りで複数指定できる |
| `ABRG_HTTP_READ_TIMEOUT` | `10s` | HTTPサーバーの読み取りタイムアウト（Go duration形式） |
| `ABRG_HTTP_WRITE_TIMEOUT` | `30s` | HTTPサーバーの書き込みタイムアウト |
| `ABRG_HTTP_IDLE_TIMEOUT` | `60s` | HTTPサーバーのアイドルタイムアウト |
| `LOG_LEVEL` | `INFO` | ログレベル（`DEBUG`, `INFO`, `WARN`, `ERROR`） |
| `LOG_FORMAT` | `auto` | ログ形式（`json` または `text`、未指定時はTTY自動判定） |

例：
```bash
PORT=8080 CACHE_PATH=/data/cache.duckdb LOG_LEVEL=DEBUG ./abrg serve
```

## CLIツール

`match`、`geocode`、`reverse` は共通のオプションを持ちます。

共通オプション:
- `-i, --input` - 入力パス（必須）
- `-o, --output` - 出力パス（必須）
- `-c, --category` - 対象カテゴリ (all, basic, rsdtdsp, parcel)。省略時はキャッシュの `enabled_category` 設定に従う
- `-p, --pref` - 検索対象の都道府県コード（例: 13）または "all"
- `-l, --limit` - 住所あたりの最大結果数 (1-5) (default: 1)
- `-q, --quiet` - プログレス表示を抑制

### `abrg match`

住所をABRデータとマッチングします。

```bash
echo "東京都千代田区紀尾井町1番3号" | ./abrg match -i /dev/stdin -o /dev/stdout -c all -q
```

### `abrg geocode`

住所をジオコーディング（住所->座標）します。

```bash
echo "東京都千代田区紀尾井町1番3号" | ./abrg geocode -i /dev/stdin -o /dev/stdout -c all -q
```

### `abrg reverse`

座標を逆ジオコーディング（座標->住所）します。入力は `経度,緯度` 形式です。

```bash
echo "139.7369,35.6812" | ./abrg reverse -i /dev/stdin -o /dev/stdout -c all -q
```

## Docker

abrg は HTTP サーバー (`serve`) として常駐するが、起動には DuckDB キャッシュが必要。先に `cache build` してから `up -d` する。

CLI 系コマンド (`cache build`, `cache info`, `match`, `geocode`, `reverse`) は `docker compose run --rm` で都度実行。`serve` は `docker compose up -d` で常駐起動。キャッシュは named volume (`abrg_cache`) で永続化されるので、`run` で作って `up` で利用できる。

`.env.example` をコピーして `.env` を作成し、`DB_PASSWORD` を abrdb と同じ値に設定する。

```bash
cp .env.example .env
# .env を編集して DB_PASSWORD を設定

docker compose build
```

### ワークフロー

事前に [abrdb](../abrdb/README.ja.md) で PostgreSQL に ABR データを import 済みにしておくこと。

```bash
# 1. キャッシュを構築（named volume に保存）
docker compose run --rm abrg_app cache build

# 2. キャッシュを検証
docker compose run --rm abrg_app cache info

# 3. サーバー起動
docker compose up -d
```
