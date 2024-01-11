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
  - [Install](#install)
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

## Install

```
npm install @digital-go-jp/abr-geocoder
```

## Usage

```
$ abrg download # Download data from the address base registry and create a database.
$ echo "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階" | abrg -
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
  abrg ./sample.txt ./output.json
  echo "東京都千代田区紀尾井町1-3" | abrg - ./output.json
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
  | ndgeojson  |Output results in geo-json format as stream output.|

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

### Matching Levels

The `level` property denotes the address maching level. 

| level | description |
|-------|-------------|
| 0 | Could not detect at all. |
| 1 | Could detect only prefecture level. |
| 2 | Could detect prefecture and city levels. |
| 3 | Could detect prefecture, city, and a town ID. |
| 4 | Could detect prefecture, city, a town ID, and a small town ID (aka, koaza). |
| 7 | Could detect prefecture, city, a town ID, and street name level. |
| 8 | Could detect prefecture, city, a town ID, street name, and extra information, such as suite number. |
