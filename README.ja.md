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

## 次のステップ

全国データや住居表示・地番データを使う場合:

1. **abrdb** でPostgreSQLにABRデータをインポート
2. **abrg** でキャッシュ構築・サーバー起動

詳細は各READMEを参照:
- [abrdb/README.ja.md](abrdb/README.ja.md)
- [abrg/README.ja.md](abrg/README.ja.md)

## データソース

本ソフトウェアは[アドレス・ベース・レジストリ](https://www.digital.go.jp/policies/base_registry_address)（ABR）を利用しています。

データの利用については[利用規約](https://www.digital.go.jp/policies/base_registry_address_tos)を参照してください。

## License

[MIT](LICENSE)
