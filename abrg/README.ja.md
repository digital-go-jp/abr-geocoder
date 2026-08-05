# Address Base Registry Geocoder

アドレス・ベース・レジストリを利用したジオコーダーです。

## 前提条件

事前に [abrdb](../abrdb/README.ja.md) で PostgreSQL にデータをインポートしてください。

## インストール

```bash
make build
./abrg --help
```

## キャッシュ管理

API サーバー・CLI ツールの両方で使用する DuckDB キャッシュを管理します。

### `abrg cache build`

PostgreSQL から DuckDB キャッシュファイルを構築します。

```bash
./abrg cache build
```

環境変数:
- `ABRG_CACHE_MEMORY_LIMIT` - 構築時の DuckDB メモリ上限（default: `8GB`。`16GB`、`512MiB` のような形式）

### `abrg cache info`

キャッシュファイルの情報を表示します。

```bash
./abrg cache info
```

## API サーバー

### `abrg serve`

API サーバーを起動します。事前に `cache build` が必要です。

```bash
./abrg serve
```

エンドポイント:

| エンドポイント | 説明 |
|---------------|------|
| `/normalize` | 住所正規化（表記揺れの統一、ABR データと照合なし） |
| `/match` | 住所マッチング（ABR データと照合） |
| `/geocode` | ジオコーディング（住所→座標） |
| `/reverse` | 逆ジオコーディング（座標→住所）※実験的 |
| `/health` | ヘルスチェック |

※実験的なエンドポイントです。今後仕様が変わる可能性があります。

API 仕様: [openapi/openapi.yml](openapi/openapi.yml)

### 環境変数

| 変数名 | デフォルト | 説明 |
|--------|----------|------|
| `PORT` | `3000` | サーバーポート |
| `CACHE_PATH` | `~/.abrg/cache/abrg.duckdb` | DuckDB キャッシュファイルのパス |
| `ABRG_DUCKDB_THREADS` | `2` | DuckDB のクエリ内並列数の上限（`0` で DuckDB 既定＝コア数） |
| `CORS_ALLOW_ORIGIN` | `*` | CORS 許可オリジン。カンマ区切りで複数指定できる |
| `ABRG_HTTP_READ_TIMEOUT` | `10s` | HTTP サーバーの読み取りタイムアウト（Go duration 形式） |
| `ABRG_HTTP_WRITE_TIMEOUT` | `30s` | HTTP サーバーの書き込みタイムアウト |
| `ABRG_HTTP_IDLE_TIMEOUT` | `60s` | HTTP サーバーのアイドルタイムアウト |
| `LOG_LEVEL` | `INFO` | ログレベル（`DEBUG`, `INFO`, `WARN`, `ERROR`） |
| `LOG_FORMAT` | `auto` | ログ形式（`json` または `text`、未指定時は TTY 自動判定） |

例：
```bash
PORT=8080 CACHE_PATH=/data/cache.duckdb LOG_LEVEL=DEBUG ./abrg serve
```

## CLI ツール

`match`、`geocode`、`reverse` は共通のオプションを持ちます。

共通オプション:
- `-i, --input` - 入力パス（必須）
- `-o, --output` - 出力パス（必須）
- `-c, --category` - 対象カテゴリ（all, basic, rsdtdsp, parcel）。省略時はキャッシュの `enabled_category` 設定に従う
- `-p, --pref` - 検索対象の都道府県コード（例: 13）または `all`
- `-l, --limit` - 住所あたりの最大結果数（1-5、default: 1）
- `-q, --quiet` - プログレス表示を抑制

### `abrg match`

住所を ABR データとマッチングします。

```bash
echo "東京都千代田区紀尾井町1番3号" | ./abrg match -i /dev/stdin -o /dev/stdout -c all -q
```

### `abrg geocode`

住所をジオコーディング（住所→座標）します。

```bash
echo "東京都千代田区紀尾井町1番3号" | ./abrg geocode -i /dev/stdin -o /dev/stdout -c all -q
```

### `abrg reverse`

座標を逆ジオコーディング（座標→住所）します。入力は `経度,緯度` 形式です。

※実験的なコマンドです。今後仕様が変わる可能性があります。

```bash
echo "139.7369,35.6812" | ./abrg reverse -i /dev/stdin -o /dev/stdout -c all -q
```

## Docker

リポジトリ直下の [docker-compose.yml](../docker-compose.yml) に PostgreSQL と一緒に定義してある。import から serve までの一連の手順は [ルート README](../README.ja.md) を参照。

CLI 系コマンド `cache build`, `cache info`, `match`, `geocode`, `reverse` は、リポジトリ直下で `run --rm` を使って都度実行する。

```bash
docker compose run --rm abrg_app cache build
docker compose run --rm abrg_app cache info
```

`serve` は `docker compose up -d abrg_app` で常駐起動する。キャッシュは named volume `abrg_cache` に残るので、`run` で作ったものを `up` がそのまま読む。abrg は `profiles: ["server"]` を付けてあり、キャッシュを作る前に起動して失敗しないよう、サービス名を指定したときだけ起動する。
