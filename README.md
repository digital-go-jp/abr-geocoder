# abr-geocoder

[日本語 (Japanese)](./README.ja.md)

Address Base Registry Geocoder by Japan Digital Agency
- Assigns a town ID.
- Normalizes address strings.
- Outputs latitude and longitude pair with matched level.

## Index
- [Requirement](./#requirement)
- [Build and Installation](./#build-and-installation)
- [Usage](./#usage)
  - [download](./#usage)
  - [update-check](./#update-check)
  - [normalize](./#normalize)
    - [normalize available options](./#available-options)
- [`nd` prefix](./#nd-prefix)
- [Fuzzy Match](./#fuzzy-match)
- [Output Formats](./#output-formats)
  - [json](./#json)
  - [geojson](./#geojson)
- [Matching Levels](./#matching-levels)

-------

## Requirement

This command requires **node.js version 18 or above**.

## Build and Installation

Since we are still working on, no `npm` package is available at this moment.
To install, build from source code on your PC.

```
$ git clone git@github.com:digital-go-jp/abr-geocoder.git
$ cd abr-geocoder
$ npm i
$ npm run build
```

Then you need to install globally,

```
(global install)
$ npm -g install .
$ abrg --version
```

or use with `npx`.
```
(local usage)
$ npx abrg --version
```

## Usage

```
$ abrg download # Download data from the address base registry and create a database.
$ echo "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階" | abrg normalize -
```

### `download`

Obtains the latest data from server.

```
$ abrg download
```

Downloads the public data from the address base registry ["全アドレスデータ"](https://catalog.registries.digital.go.jp/rc/dataset/ba000001) into the `$HOME/.abr-geocoder` directory,
then creates a local database using SQLite.

To update the local database, runs `abrg download`.

### `update-check`

Checks the new update data.

```
$ abrg update-check
```

Returns `0` if the local database is the latest.

Returns `1` if new data in CKAN is available. there is no local database, returns `1` and exits. In that case, runs `download` command.

### `normalize`

Geocodes Japanese addresses.

```
$ abrg normalize [options] <inputFile>
```

Geocodes from the `<inputFile>`. The input file must have Japanese address each line.

For example:

```sample.txt
東京都千代田区紀尾井町1-3
東京都千代田区永田町1-10-1
...
東京都千代田区永田町一丁目7番1号
```

You can also pass the input query through `pipe` command. `-` denotes `stdin`.

```
echo "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階" | abrg normalize -
```

#### Available options

- `-f`, `--format`

   Specifies output format. Default is `table` which draws an output table on CLI.
   You can also specify `json` or `geojson`.

- `--fuzzy`

   Allows `?` characters for wildcard matching.
  
- `-h`, `--help`

   Displays this command usage.


#### `nd` prefix

If you specify format with prefix `nd`, i.e. `ndjson`, outputs geocoding results for each query Japanese address.

Without the `nd` prefix, the command outputs the results after all processes are done.

### Fuzzy Match

You can include `?` character for wildcard matching with `--fuzzy` option.

```
$ echo '東京都千代?区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階' | abrg normalize --format=ndjson -
{"pref":"東京都","city":"","town":"","other":"千代?区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階","lat":null,"lon":null,"level":1}

$ echo '東京都千代田区紀尾?町1-3　東京ガーデンテラス紀尾井町 19階、20階' | abrg normalize --fuzzy --format=ndjson -
{"pref":"東京都","city":"千代田区","lg_code":"131016","town":"紀尾井町","town_id":"0056000","other":"東京ガーデンテラス紀尾井町 19階、20階","lat":35.679107172,"lon":139.736394597,"level":8,"addr1":"3","blk":"1","blk_id":"001","addr1_id":"003","addr2":"","addr2_id":""}
```

## Output Formats

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

The `level` property denotes the address maching level. Only in the `json` or `geojson` formats are available.

| level | description |
|-------|-------------|
| 0 | Could not detect at all. |
| 1 | Could detect only prefecture level. |
| 2 | Could detect prefecture and city levels. |
| 3 | Could detect prefecture, city, and a town ID. |
| 7 | Could detect prefecture, city, a town ID, and street name level. |
| 8 | Could detect prefecture, city, a town ID, street name, and extra information, such as suite number. |
