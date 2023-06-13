# abr-geocoder

[日本語 (Japanese)](./README.ja.md)

Address Base Registry Geocoder by Japan Digital Agency
- Assigns a town ID.
- Normalize address strings.
- Output latitude/longitude and matching level.

## Requirement

```
"node": ">=16"
```

## Usage

```
$ yarn global add digital-go-jp/abr-geocoder
$ abr-geocoder download # Download data from the address base registry and create a database.
$ echo "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階" | abr-geocoder normalize -
```

### `download`

Download the latest data.

```
$ abr-geocoder download
```

Download the address base registry ["全アドレスデータ"](https://catalog.registries.digital.go.jp/rc/dataset/ba000001) to the `$HOME/.abr-geocoder` directory, Extract it into a SQLite database file.

To update a database that has already been created, run `abr-geocoder download` again and it will be updated. If there are no updates, the update will be skipped.

### `update-check`

Check that the local data is up-to-date.

```
$ abr-geocoder update-check
```
Rturns `0` if the data is up-to-date and exits normally. If there is new data in CKAN (including the case where the local data could not be checked), returns `1` and exits aborted.

If there is new data, update it with the `download` subcommand.

### `normalize`

Geocode the address.

```
$ abr-geocoder normalize --help
Usage: abr-geocoder normalize [options] <inputFile>

入力されたアドレスをジオコーディングする。 <inputFile> にアドレスが改行で分けられたファイルを指定してください。標準入力で渡したい場合は、 '-' を指定してください。

Options:
  -f|--format <outputFormat>  出力フォーマットを指定する。デフォルトは `table`。対応オプション: table, ndjson, json, ndgeojson, geojson (default: "table")
  -h, --help                  display help for command
```

`--format` option defaults to table and is displayed as a table type on the CLI. For samples of JSON output and GeoJSON output, see "Output Format" below.

Note that formats beginning with a letter other than nd are buffer type and output results after all rows are processed. Formats beginning with nd are streaming type and output results one line at a time.

### Fuzzy Match

Use the `?` wildcard can be used for fuzzy matching. `--fuzzy` option.

```
$ echo '東京都千代?区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階' | abr-geocoder normalize --format=ndjson -
{"pref":"東京都","city":"","town":"","other":"千代?区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階","lat":null,"lon":null,"level":1}

$ echo '東京都千代田区紀尾?町1-3　東京ガーデンテラス紀尾井町 19階、20階' | abr-geocoder normalize --fuzzy --format=ndjson -
{"pref":"東京都","city":"千代田区","lg_code":"131016","town":"紀尾井町","town_id":"0056000","other":"東京ガーデンテラス紀尾井町 19階、20階","lat":35.679107172,"lon":139.736394597,"level":8,"addr1":"3","blk":"1","blk_id":"001","addr1_id":"003","addr2":"","addr2_id":""}
```

## Output Format

### `json`

```
[
  {
    "pref": "東京都", // 都道府県名
    "city": "千代田区", // 市区町村名
    "lg_code": "131016", // 全国地方公共団体コード
    "town": "紀尾井町", // 町字
    "town_id": "0056000", // 町字ID
    "blk": "1", // 街区符号
    "blk_id": "001", // 街区ID
    "addr1": "3", // 住居番号
    "addr1_id": "003",// 住居ID
    "addr2": "", // 住居番号2
    "addr2_id": "", // 住居2ID
    "other": "東京ガーデンテラス紀尾井町 19階、20階", // 正規化できなかった部分
    "level": 8, // マッチングレベル
    "lat": 35.679107172, // 代表点_緯度
    "lon": 139.736394597 // 代表点_経度
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

### Matching Levels

If you use JSON / GeoJSON output, it is in the level property.

```
0 - 都道府県も判別できなかった。
1 - 都道府県まで判別できた。
2 - 市区町村まで判別できた。
3 - 町字まで判別できた。
7 - 住居表示の街区までの判別ができた。
8 - 住居表示の街区符号・住居番号までの判別ができた。
```
