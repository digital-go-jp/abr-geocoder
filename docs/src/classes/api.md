# Classes: API Server

## AbrgApiServer（`src/interface/abrg-api-server/index.ts`）

責務:

- `GET /geocode` ハンドリング（CORS 設定、入力検証、フォーマット変換）
- エラー応答（`500`/`404`）

## OnGeocodeRequest（`src/interface/abrg-api-server/on-geocode-request.ts`）

責務:

- クエリ検証（`address` 必須、`fuzzy` は1文字、`target/format` は既定集合）
- `FormatterProvider` を用いて `json/csv/geojson/ndjson` へストリーム出力
- AbrGeocoder へ単発リクエストを発行

## CliServer（`src/interface/cli-server/index.ts`）

責務:

- `/command` POST を受け付け、CLI 操作を HTTP 化（CORS 設定）

