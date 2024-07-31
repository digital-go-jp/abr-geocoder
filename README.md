
# abr-geocoder (Digital Agency Address Base Registry Geocoder)

- [日本語版](./README.ja.md)

## Description

A geocoder that matches input address strings with the [Address Base Registry](https://catalog.registries.digital.go.jp/rc/dataset/) maintained by the Digital Agency, Government of Japan, outputting normalized address strings, town IDs, latitude and longitude, etc. It analyzes Japanese domestic address notation, absorbs variations, and outputs normalized results according to the hierarchy.

![Image](https://lp.geocoder.address-br.digital.go.jp/assets/2024072820391722166771.png)

## Features

- Geocoder targeting domestic addresses in Japan.
- Normalizes address notation according to the [Address Base Registry](https://catalog.registries.digital.go.jp/rc/dataset/) and hierarchy.
- Supports `residence indication` and `partial number (lot number)`.
- Uses SQLite, enabling geocoding within the server.
- High-speed processing through multithreading.
- Supports six output formats: `csv`, `json`, `geojson`, `ndjson`, `ndgeojson`, `simplified`.

## Use Cases

- Usable as a command:
  - Pipeline with standard input/output.
  - Input/output via file.
- Usable as a REST server.
- Usable as a Node.js library:
  - Supports individual requests and streams.

## Limitations

- Cannot search by landmarks (e.g., famous facility names).
- Cannot search by postal codes.
- Cannot search by alphabet (English notation).
- Limited support for searches by Kyoto street names.
- Cannot search by incomplete address notation.

## Installation

  - Global installation
    ```sh
    npm install -g @digital-go-jp/abr-geocoder
    abrg  # Verify it runs
    ```

  - Local install 
    ```sh
    npm install @digital-go-jp/abr-geocoder
    npm link
    abrg  # Verify it runs
    ```

## `abrg download` command

Downloads the necessary dataset for geocoding from the [Address Base Registry](https://catalog.registries.digital.go.jp/rc/dataset/) and builds the database using SQLite.

```sh
abrg download [options]
```

- <details>
  <summary>Specify region(s) for download</summary>

  You can specify a particular prefecture or municipality to build a localized database, reducing the data size and speeding up database construction.

  Use the [National Local Government Codes](https://www.soumu.go.jp/denshijiti/code.html) to specify the region(s). Separate multiple regions with spaces.

  ```sh
  # Download data for Tokyo
  abrg download -c 130001

  # Download data for Tokyo and Kanagawa
  abrg download -c 130001 140007

  # Download data for Chiyoda ward
  abrg download -c 131016
  ```
</details>

- <details>
  <summary>Change directory</summary>

  You can change the directory to download the dataset files and save the database. The default is `$HOME/.abr-geocoder`.

  ```sh
  abrg download -d (path to directory to save data)
  ```
</details>

- <details>
  <summary>Hide progress bar</summary>
  If you specify the silent option, the progress bar will not be displayed.

  ```sh
  abrg download --silent
  ```
</details>

- <details>
  <summary>Show debug information</summary>
  Shows the time taken for the process when it is completed.

  ```sh
  abrg download --debug
  ```
</details>

## `abrg update-check` command

Checks for data updates. If there is local data, it checks for updates in the municipalities contained in the database. If new data is available, it can be downloaded.

```sh
abrg update-check [options]
```

- <details>
  <summary>Pre-specify yes/no</summary>
  You can pre-specify whether to continue downloading if update data is available.

  ```sh
  # Continue downloading
  abrg update-check --yes

  # Do not continue downloading
  abrg update-check --no
  ```
</details>

- <details>
  <summary>Hide progress bar</summary>
  If you specify the silent option, the progress bar will not be displayed.

  ```sh
  abrg update-check --silent
  ```
</details>

- <details>
  <summary>Change directory</summary>

  Specifies the directory to save the database. The default is `$HOME/.abr-geocoder`.

  ```sh
  abrg update-check -d (path to directory to save data)
  ```
</details>

- <details>
  <summary>Show debug information</summary>
  Shows the time taken for the process when it is completed.

  ```sh
  abrg update-check --debug
  ```
</details>

## `abrg` command

Geocodes the input address string with the database and outputs normalized address strings, town IDs, latitude, longitude, etc.

```sh
$ abrg <inputFile> [<outputFile>] [options]
```

- `<inputFile>`
  
  Specifies how to input data into the command.

  - <details>
    <summary>If a file path is specified</summary>
    The specified text file will be geocoded. Enter one address per line.

    Example:
    ```sh
    abrg ./sample.txt
    ```

    sample.txt:
    ```
    東京都千代田区紀尾井町1-3   // 1-3 Kioicho, Chiyoda-ku, Tokyo
    東京都千代田区永田町1-10-1  // 1-10-1 Nagatacho, Chiyoda-ku, Tokyo
    ...
    東京都千代田区永田町一丁目7番1号  // 1-7-1 Nagatacho, Chiyoda-ku, Tokyo
    ```
    </details>

  - <details>
    <summary>If "-" is specified</summary>
    Receives data from standard input.

    Example:
    ```sh
    echo "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階" | abrg -
    ```
    </details>
    

- `<outputFile>`

  Specifies where to output the processing results. If omitted, outputs to standard output (stdout).

  - <details>
    <summary>If a file path is specified</summary>
    Outputs the processing results to the specified file. The output format is based on the `--format` option.

    Example:
    ```sh
    abrg ./input.txt ./output.json
    ```
    </details>

  - <details>
    <summary>If omitted</summary>
    If omitted, outputs to standard output (stdout).

    Example:
    ```sh
    cat ./sample.txt | abrg - | jq
    ```
    </details>
    
- <details>
  <summary>Change output format</summary>
  
  You can change the output format with the `-f`, `--format` option. The default is `json`.

  | format     | Description                                                   |
  |------------|---------------------------------------------------------------|
  | csv        | Outputs results in comma-separated csv format                 |
  | simplified | Outputs results in comma-separated csv format with limited fields |
  | json       | Outputs results in JSON format                                |
  | ndjson     | Outputs results in NDJSON format                              |
  | geojson    | Outputs results in GeoJSON format                             |
  | ndgeojson  | Outputs results in NDGeoJSON format                           |

  </details>

- <details>
  <summary>Specify wildcard character</summary>
  You can specify any character as a wildcard. Useful for cases where certain characters like old kanji that can't be expressed in utf-8 are converted to ● (black circle). The default is `?`.

  Example:
  ```sh
  echo "東京都町●市森野2-2-22" | abrg - --fuzzy "●"
  ```
  </details>

- <details>
  <summary>Hide progress bar</summary>
  If you specify the silent option, the progress bar will not be displayed.

  ```sh
  abrg ./input.txt ./output.txt --silent
  ```
  </details>

- <details>
  <summary>Change directory</summary>

  Specifies the directory to save the database. The default is `$HOME/.abr-geocoder`.

  ```sh
  abrg ./input.txt ./output.txt  -d (path to directory to save data)
  ```
  </details>

- <details>
  <summary>Show debug information</summary>
  Shows the time taken for the process when it is completed. Also outputs the primary key information of each table matched to the input address string.

  ```sh
  abrg ./input.txt ./output.txt --debug
  ```
  </details>

## `abrg serve` command

Starts the geocoder as a REST API server.

```sh
abrg serve [options]
```

- <details>
  <summary>Change port number</summary>

  Changes the port number for the REST API server. The default is `3000`.

  ```sh
  abrg serve -p 8080
  ```
</details>

- <details>
  <summary>Change directory</summary>

  Specifies the directory to save the database. The default is `$HOME/.abr-geocoder`.

  ```sh
  abrg serve  -d (path to directory to save data)
  ```
</details>
