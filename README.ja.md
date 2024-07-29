# abr-geocoder

デジタル庁 アドレス・ベース・レジストリ ジオコーダー

## abr-geocoderについて

与えられた日本国内の住所を分析し、住所表記の揺れを正規化した住所表記と緯度経度情報を返します。
デジタル庁が公開している[アドレス・ベース・レジストリ](https://catalog.registries.digital.go.jp/rc/dataset/)の情報を基にして処理を行います。

## 特徴

- 無料で利用できる。
- データベースをPC内に構築して実行できる。
- 日本全国を対象としたデータベースを構築できる。
- 特定の市区町村のみを対象としたデータベースを構築できる。
- `地番` と `住居表示` を対象に検索。どちらか片方だけを検索対象にすることも可能。
- 全てオープンソース。
- MITライセンスに基づき、ソースコードの修正・再利用・再配布可能。
- Node.js version 20以上で動作。
- コマンドとして利用できる。
- サーバーとして利用する。
- Node.jsのライブラリとして利用可能。
- `csv`, `json`, `geojson`, `ndjson`, `ndgeojson`, `simplified` の6つの出力形式をサポート。
- マルチスレッドによる高速処理。

## できないこと

- ランドマーク（有名な施設名など）による検索
- 郵便番号による検索
- アルファベット（英語表記）による検索
- 京都の通り名による検索（※一部対応）
- 不完全な住所表記による検索

## サンプル

`abrg` コマンドに外部から入力を与えて使用する例です。デフォルトでは `json` 形式で出力します。
(以下の例では、`jq`コマンドを使用して、出力結果を見やすく整形しています)
```sh
echo "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階" | abrg - | jq .
[
  {
    "query": {
      "input": "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階"
    },
    "result": {
      "output": "東京都千代田区紀尾井町1-3 　東京ガーデンテラス紀尾井町 19階、20階",
      "score": 0.98,
      "other": "　東京ガーデンテラス紀尾井町 19階、20階",
      "match_level": "residential_detail",
      "lg_code": "131016",
      "pref": "東京都",
      "county": null,
      "city": "千代田区",
      "ward": null,
      "machiaza_id": "0056000",
      "oaza_cho": "紀尾井町",
      "chome": null,
      "koaza": null,
      "blk_num": 1,
      "blk_id": "001",
      "rsdt_num": 3,
      "rsdt_id": "003",
      "rsdt_num2": null,
      "rsdt2_id": null,
      "rsdt_addr_flg": 1,
      "prc_num1": null,
      "prc_num2": null,
      "prc_num3": null,
      "prc_id": null,
      "lat": 35.679107172,
      "lon": 139.736394597,
      "coordinate_level": "residential_detail"
    }
  }
]
```

## インストール

```sh
npm i @digital-go-jp/abr-geocoder
npm run build
npm link
abrg  # 実行できることを確認
```

## 使い方
  <details>
    <summary><strong>1. データのダウンロード</strong></summary>

[アドレス・ベース・レジストリ](https://catalog.registries.digital.go.jp/rc/dataset/)からデータをダウンロードし、データベースを構築します。
```sh
# 日本全国のデータをダウンロード

abrg download
```


特定の都道府県や市町村を指定して、地域を限定したデータベースを構築することが可能です。これによりダウンロードするデータサイズを抑え、データベースを早く構築することが出来るようになります。

地域を指定するコードは、[全国地方公共団体コード](https://www.soumu.go.jp/denshijiti/code.html)を指定します。
複数の地域を指定する場合は、半角空白で区切ります。

```sh
# 東京都のデータをダウンロードする
abrg download -c 130001

# 東京都と神奈川県のデータをダウンロードする
abrg download -c 130001 140007

# 千代田区のデータをダウンロードする
abrg download -c 131016
```

  </details>
  <details>
    <summary><strong>2. ジオコーディング</strong></summary>

## 標準入力からの入力

別のコマンドからの出力結果を、パイプを通して受け取り、結果を標準出力に出力します。
```sh
echo "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階" | abrg -
```

## ファイルからの入力

入力ファイルのパスを指定し、ジオコーディングを行います。結果を標準出力に出力します。
1行に1住所が記入されたファイルとして扱います。
コメント行として `//` や `/* ... */` が使用できます。
```sh
abrg (path to)input.txt
```

## ファイルへの出力

入力ファイルのパスを指定し、ジオコーディングを行います。結果を標準出力に出力します。
```sh
abrg (path to)input.txt (path to)output.json
```

## 出力形式の変更

出力時のフォーマットを変更します。
```sh
abrg (path to)input.txt (path to)output.csv -f csv
```

  </details>
