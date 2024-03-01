# abr-geocoder
デジタル庁 アドレス・ベース・レジストリ ジオコーダー
- 町字IDを付与する
- アドレス（住所・所在地）文字列を正規化する
- 緯度経度とマッチングレベルを出力する

## インデックス
- [abr-geocoder](#abr-geocoder)
  - [インデックス](#インデックス)
  - [ドキュメント](#ドキュメント)
  - [使用環境](#使用環境)
  - [インストール](#インストール)
  - [使い方](#使い方)
    - [`download`](#download)
    - [`update-check`](#update-check)
    - [`geocoding`](#geocoding)
  - [出力結果のフォーマット](#出力結果のフォーマット)
    - [`json`](#json)
    - [`geojson`](#geojson)
    - [マッチングレベルについて](#マッチングレベルについて)
  
## ドキュメント
- [このプロジェクトへの参加について](docs/CONTRIBUTING.ja.md)

-------

## 使用環境

コマンドを実行するためには **node.js version 18以上** が必要です。

## インストール

```
$ npm install @digital-go-jp/abr-geocoder
```

## 使い方

```
$ abrg download # アドレス・ベース・レジストリのデータをダウンロードし、データベース作成を行う
$ echo "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階" | abrg -
```

### `download`

  サーバーから最新データを取得します。

  ```
  $ abrg download
  ```

  アドレス・ベース・レジストリの[「全アドレスデータ」](https://catalog.registries.digital.go.jp/rc/dataset/ba000001) を `$HOME/.abr-geocoder` ディレクトリにダウンロードし、SQLiteを使ってデータベースを構築します。

  作成済みのデータベースを更新するには、`abrg download` を実行します。

### `update-check`

  データのアップデートの有無を確認します。

  ```
  $ abrg update-check
  ```

  CKANに新しいデータがある場合（ローカルのデータを確認できなかった場合を含む）は、戻り値 `0` を返し終了します。
  最新である場合は戻り値 `1` を返し終了します。

  新しいデータがある場合は、`download` サブコマンドで更新してください。

### `geocoding`

`<inputFile>`で指定されたファイルに含まれる住所をジオコーディングします。
`-` を指定した場合、標準入力からデータを入力することができます。

```
$ abrg <inputFile> [<outputFile>] [options]
```



- `<inputFile>`
  - 【ケース】ファイルへのパスを指定した場合
    指定されたテキストファイルをジオコーディングします。
    １行単位（１行につき１つのアドレス）で記入してください。

    例：
    ```
    abrg ./sample.txt
    ```

    sample.txt
    ```
    東京都千代田区紀尾井町1-3
    東京都千代田区永田町1-10-1
    ...
    東京都千代田区永田町一丁目7番1号
    ```
  - `-` を指定した場合
    標準入力からデータを受け取ります。

    例：
    ```
    echo "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階" | abrg -
    ```

- `<outputFile>`
  指定されたファイルにデータを保存します。省略された場合は標準出力(stdout)に出力されます。

    例：
    ```
    abrg ./sample.txt ./output.json
    echo "東京都千代田区紀尾井町1-3" | abrg - ./output.json
    cat ./sample.txt | abrg - | jq
    ```
    
- `-f`, `--format`

   出力書式を指定します。デフォルトは`json`です。
   | format  | 説明                                                            |
   |---------|----------------------------------------------------------------|
   | csv     |カンマ区切りのcsv形式で結果を出力します                               |
   | json    |JSON形式で結果を出力します                                          |
   | ndjson  |NDJSON形式で結果を出力します   |
   | geojson |GeoJSON形式で結果を出力します                                       |
   | ndgeojson  |NDGeoJSON形式で結果を出力します|

- `--fuzzy`

  - `--fuzzy` の後ろに、任意の1文字を指定することで、ワイルドカードとして使う文字を変更することが出来ます。デフォルトは`?`です。
    例:
    ```
    echo "東京都町?市森野2-2-22" | abrg - -f json --fuzzy "?"
    ```

## 出力結果のフォーマット

### `json`

```
[
  {
    "query": {
      "input": "東京都千代田区紀尾井町1-3"
    },
    "result": {
      "prefecture": "東京都",
      "match_level": 8,
      "city": "千代田区",
      "town": "紀尾井町",
      "town_id": "0056000",
      "lg_code": "131016",
      "other": "",
      "lat": 35.679107172,
      "lon": 139.736394597,
      "block": "1",
      "block_id": "001",
      "addr1": "3",
      "addr1_id": "003",
      "addr2": "",
      "addr2_id": ""
    }
  }
]
```

### `geojson`

```
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          139.736394597,
          35.679107172
        ]
      },
      "properties": {
        "query": {
          "input": "東京都千代田区紀尾井町1-3"
        },
        "result": {
          "match_level": 8,
          "prefecture": "東京都",
          "city": "千代田区",
          "town": "紀尾井町",
          "town_id": "0056000",
          "lg_code": "131016",
          "other": "",
          "block": "1",
          "block_id": "001",
          "addr1": "3",
          "addr1_id": "003",
          "addr2": "",
          "addr2_id": ""
        }
      }
    }
  ]
}
```

### マッチングレベルについて

`level` プロパティは、マッチしたアドレスの精度を示しています。

| level | description |
|-------|-------------|
| 0 | 全く判定できなかった |
| 1 | 都道府県レベルまで判別できた |
| 2 | 市区町村まで判別できた |
| 3 | 町字まで判別できた |
| 7 | 住居表示の街区までの判別ができた |
| 8 | 住居表示の街区符号・住居番号までの判別ができた |
