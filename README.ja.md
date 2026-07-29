# ABR Geocoder

[English](README.md)

デジタル庁のアドレス・ベース・レジストリ（ABR）を活用した日本の住所処理ツールです。

## クイックスタート

```bash
cd quickstart
docker compose up -d
curl -s "http://localhost:3001/geocode?address=東京都千代田区紀尾井町1-3"
```

テストデータ（東京都の町字まで）を同梱。詳細は [quickstart/README.md](quickstart/README.md) を参照。

## 全国データ

全国データや住居表示・地番データを使うには PostgreSQL が必要になる。リポジトリ直下の [docker-compose.yml](docker-compose.yml) が PostgreSQL・abrdb・abrg をまとめて扱う。

```bash
cp .env.example .env
# .env を編集して DB_PASSWORD を設定

docker compose up -d postgres

# 取り込む範囲を決めて初期化する
docker compose run --rm abrdb_app init --pref all --category all --pos

# ABR からダウンロードして PostgreSQL に取り込む
docker compose run --rm abrdb_app import

# PostgreSQL から DuckDB キャッシュを構築する
docker compose run --rm abrg_app cache build

# APIサーバーを起動する
docker compose up -d abrg_app
curl -s "http://localhost:3000/geocode?address=東京都千代田区紀尾井町1-3"
```

データは3つの named volume に残る。

| Volume | 内容 |
|--------|------|
| `postgres_data` | PostgreSQL のデータベース |
| `abrdb_data` | ダウンロードした ABR のアーカイブ |
| `abrg_cache` | abrg が読む DuckDB キャッシュ |

`docker compose down` ではこれらは消えない。作り直すときは `down -v` を使う。

コマンドごとのオプションは各 README を参照:
- [abrdb/README.ja.md](abrdb/README.ja.md)
- [abrg/README.ja.md](abrg/README.ja.md)

## データソース

本ソフトウェアは[アドレス・ベース・レジストリ](https://www.digital.go.jp/policies/base_registry_address)（ABR）を利用しています。

データの利用については[利用規約](https://www.digital.go.jp/policies/base_registry_address_tos)を参照してください。

## License

[MIT](LICENSE)
