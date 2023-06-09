# abr-geocoder
デジタル庁 アドレス・ベース・レジストリ(ABR) ジオコーダー
- 町字IDを付与する
- アドレス（住所・所在地）文字列を正規化する
- 緯度経度とマッチングレベルを返す

## Requirement

```
"node": ">=16"
```

## Usage

```
yarn global add digital-go-jp/abr-geocoder
abr-geocoder download # アドレス・ベース・レジストリのデータをダウンロードし、データベース作成を行う
echo "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階" | abr-geocoder normalize -
```

### `download`

最新データをダウンロードする。

```
$ abr-geocoder download
```

アドレス・ベース・レジストリの[「全アドレスデータ」](https://catalog.registries.digital.go.jp/rc/dataset/ba000001) を `$HOME/.abr-geocoder` ディレクトリにダウンロードし、SQLiteのデータベースファイルに展開します。

作成済みのデータベースを更新するには、もう一度 `abr-geocoder download` コマンドを実行すると更新されます。更新がない場合は、更新をスキップします。

### `update-check`

ローカルのデータが最新であることを確認する。

```
$ abr-geocoder update-check
```

最新である場合は戻り値 `0` を返し、正常終了します。
CKANに新しいデータが存在する場合（ローカルのデータを確認できなかった場合を含む）は、戻り値 `1` を返し、異常終了します。

新しいデータがある場合は、`download` サブコマンドで更新してください。

### `normalize`

入力のアドレスをジオコーディングする。

```
$ abr-geocoder normalize --help
Usage: abr-geocoder normalize [options] <inputFile>

アドレスをジオコーディングする。 <inputFile> にジオコーディングさせるアドレスが改行で分けられたファイルを指定してください。標準入力で渡したい場合は、 `-` を指定してください。

Options:
  -f|--format <outputFormat>  出力フォーマットを指定する。デフォルトは `table`。対応オプション: table, ndjson, json, ndgeojson, geojson (default: "table")
  -h, --help                  display help for command
```

主なオプションは `--format` となります。デフォルトは `table` に設定し、CLI上に表型に表示されます。
JSONの出力や、GeoJSONの出力のサンプルは下記「出力結果のフォーマット」をご確認ください。

なお、 `nd` 以外で始まるフォーマットは、バッファ型で全行処理後に結果を出力します。 `nd` から始まるフォーマットはストリーミング型で、入力の住所一行づつ結果を出力します。

### 曖昧一致ワイルドカード

`?` のワイルドカードを利用して曖昧一致させることができます。 `--fuzzy` オプションを利用してください。

```
$ echo '東京都千代田区紀尾?町1-3　東京ガーデンテラス紀尾井町 19階、20階' | abr-geocoder normalize --format=ndjson -
{"pref":"東京都","city":"千代田区","lg_code":"131016","town":"","other":"紀尾?町1-3 東京ガーデンテラス紀尾井町 19階、20階","lat":null,"lon":null,"level":2}

$ echo '東京都千代田区紀尾?町1-3　東京ガーデンテラス紀尾井町 19階、20階' | abr-geocoder normalize --fuzzy --format=ndjson -
{"pref":"東京都","city":"千代田区","lg_code":"131016","town":"紀尾井町","town_id":"0056000","other":"東京ガーデンテラス紀尾井町 19階、20階","lat":35.679107172,"lon":139.736394597,"level":8,"addr1":"3","blk":"1","blk_id":"001","addr1_id":"003","addr2":"","addr2_id":""}
```

## 出力結果のフォーマット

### `json`

```
{
  "pref": "東京都", // 都道府県名
  "city": "千代田区", // 市区町村名
  "lg_code": "131016", // 全国地方公共団体コード
  "town": "紀尾井町", // 町字
  "town_id": "0056000", // 町字ID
  "other": "東京ガーデンテラス紀尾井町 19階、20階", // 正規化できなかった部分
  "lat": 35.679107172, // 代表点_緯度
  "lon": 139.736394597, // 代表点_経度
  "level": 8, // マッチングレベル
  "blk": "1", // 街区符号
  "blk_id": "001", // 街区ID
  "addr1": "3", // 住居番号
  "addr1_id": "003",// 住居ID
  "addr2": "", // 住居番号2
  "addr2_id": "" // 住居2ID
}
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
        "title": "東京都千代田区紀尾井町1-3",
        "level": 8,
        "pref": "東京都",
        "city": "千代田区",
        "lg_code": "131016",
        "town": "紀尾井町",
        "town_id": "0056000",
        "blk": "1",
        "blk_id": "001",
        "addr1": "3",
        "addr1_id": "003",
        "addr2": "",
        "addr2_id": "",
        "other": "東京ガーデンテラス紀尾井町 19階、20階"
      }
    }
  ]
}
```

### マッチングレベルについて

JSON / GeoJSON 出力を利用する場合は `level` プロパティに入ってます。

```
0 - 都道府県も判別できなかった。
1 - 都道府県まで判別できた。
2 - 市区町村まで判別できた。
3 - 町字まで判別できた。
7 - 住居表示の街区までの判別ができた。
8 - 住居表示の街区符号・住居番号までの判別ができた。
```
