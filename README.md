# abr-geocoder

[日本語 (Japanese)](./README.ja.md)

Address Base Registry Geocoder by Japan Digital Agency
- Assigns a town ID.
- Normalizes address strings.
- Outputs latitude and longitude pair with matched level.

## Index
- [abr-geocoder](#abr-geocoder)
  - [Index](#index)
  - [Documents](#documents)
  - [Requirement](#requirement)
  - [Build and Installation](#build-and-installation)
  - [Usage](#usage)
    - [`download`](#download)
    - [`update-check`](#update-check)
    - [`geocode` (without command is specified)](#geocode-without-command-is-specified)
  - [Output Formats](#output-formats)
    - [`json`](#json)
    - [`geojson`](#geojson)
    - [Matching Levels](#matching-levels)

## Documents
- [Contributing this project](docs/CONTRIBUTING.md)

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

### `geocode` (without command is specified)

Geocodes from the `<inputFile>`. 
You can also specify `-` for stdin.

```
$ abrg <inputFile> [<outputFile>] [options]
```

- `<inputFile>`
  - case: Specifies a query file path:
    Geocodes from the `<inputFile>`. The input file must have Japanese address each line.

    For example:
    ```
    abrg ./sample.txt
    ```

    ```sample.txt
    東京都千代田区紀尾井町1-3
    東京都千代田区永田町1-10-1
    ...
    東京都千代田区永田町一丁目7番1号
    ```

  - case: Specifies `-`:
    You can also pass the input query through `pipe` command. `-` denotes `stdin`.

    ```
    echo "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階" | abrg -
    ```

- `<outputFile>`
  Specifies the file path to save the output.
  If you ommit, the command prints out to stdout.

  For example：
  ```
  abrg ./sample.txt ./output.csv
  echo "東京都千代田区紀尾井町1-3" | abrg - ./output.csv
  cat ./sample.txt | abrg - | jq
  ```

- `-f`, `--format`

  Specifies output format. Default is `json`.
  | format  | 説明                                               |
  |---------|---------------------------------------------------|
  | csv     |Output results in comma-separated csv format.      |
  | json    |Output results in json format.                     |
  | ndjson  |Output results in json format as stream output.    |
  | geojson |Output results in geo-json format.                 |
  | ndjson  |Output results in geo-json format as stream output.|

- `--fuzzy`

  - case: just `--fuzzy`
    Allows `?` character for wildcard matching.
    
    For example:
    ```
    echo "東京都町?市森野2-2-22" | abrg - --fuzzy
    ```

  - case: `--fuzzy` with `(a)`
  
    Allows `(a)` character for wildcard matching.

    For example:
    ```
    echo "東京都町●市森野2-2-22" | abrg - --fuzzy ●
    ```
  
- `-h`, `--help`

   Displays this command usage.

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

The `level` property denotes the address maching level. 

| level | description |
|-------|-------------|
| 0 | Could not detect at all. |
| 1 | Could detect only prefecture level. |
| 2 | Could detect prefecture and city levels. |
| 3 | Could detect prefecture, city, and a town ID. |
| 7 | Could detect prefecture, city, a town ID, and street name level. |
| 8 | Could detect prefecture, city, a town ID, street name, and extra information, such as suite number. |
