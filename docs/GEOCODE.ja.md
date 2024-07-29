[インデックス](../README.md) > `abrg`

# `abrg` コマンド

入力からデータを読み取り、ジオコーディングした結果を出力します。
入力にはファイルを指定する方法と、標準入力を通じて渡す方法があります。
出力も同様に、ファイルの書き込み先を指定するか、標準出力に出力することができます。
出力するデータの形式を指定することが可能です。


## デフォルト

`inputFile`からファイルを読み取り、`outputFile`に出力結果を保存します。

```sh
$ abrg (inputFile) (outputFile)
```

パイプを使うと`標準入力`からデータを読み取ります。
`-`を指定すると、`標準出力`にデータを出力します。
デフォルトの出力形式は、`json` です。

```sh
$ echo "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階" | abrg -
```

入力ファイルを指定することができます。結果は`標準出力`に出力されます。
```sh
$ abrg ./input-address.txt 
```

出力ファイルを指定することも可能です。
```sh
$ abrg ./input-address.txt ./output.json
```

ファイルから住所を入力する場合、1行に1つの住所を記載します。
`//`は1行コメントアウト, `/* ... */`は複数行をコメントアウトすることが可能です。
```js
// 警察庁
東京都千代田区霞が関2丁目1番2号

/*
(ここはコメントアウトされるので、処理されない)
東松島市宮戸字月浜一丁目2番地22
紺屋町外6字入会字14号北谷日向甲89
*/

// =================================
// 大阪府北区と東京都北区のテスト
// =================================
北区扇町2丁目1番27号
北区王子2丁目1番21号
```

## --format オプション

  出力書式を指定します。省略された場合は `json` で出力されます。
  <!-- | format   | 説明                                                       |
  |----------|-----------------------------------------------------------|
  | csv      | カンマ区切りのcsv形式で結果を出力します                         |
  | json     |                                     |
  | ndjson   | NDJSON形式で結果を出力します                                  |
  | geojson  |                                  |
  | ndgeojson| NDGeoJSON形式で結果を出力します                               |
  | simplified|     | -->
  
  <details>
    <summary><strong>csv</strong>: カンマ区切りのcsv形式で結果を出力します。</summary>

```csv
input,score,output,other,match_level,lg_code,pref,county,city,ward,machiaza_id,oaza_cho,chome,koaza,block,block_id,rsdt_num,rsdt_id,rsdt_num2,rsdt2_id,rsdt_addr_flg,prc_num1,prc_num2,prc_num3,prc_id,lat,lon
"東京都千代田区紀尾井町1-3","1","東京都千代田区紀尾井町1-3",,residential_detail,131016,東京都,,千代田区,,0056000,紀尾井町,,,1,001,3,003,,,1,,,,,35.679107172,139.736394597
```

  </details>
  
  <details>
    <summary><strong>normalize</strong>: カンマ区切りのcsv形式で、限られたフィールドの結果のみを出力します</summary>

```csv
"東京都千代田区紀尾井町1-3","1","東京都千代田区紀尾井町1-3",residential_detail
```

  </details>

  <details>
    <summary><strong>json</strong>: JSON形式で結果を出力します</summary>

```json
[
  {
    "query": {
      "input": "東京都千代田区紀尾井町1-3"
    },
    "result": {
      "output": "東京都千代田区紀尾井町1-3",
      "score": 1,
      "other": null,
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
      "block": "1",
      "block_id": "001",
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
      "lon": 139.736394597
    }
  }
]
```
  </details>

  <details>
    <summary><strong>ndjson</strong>: NDJSON形式で結果を出力します</summary>

```json
{
  "query": {
    "input": "東京都千代田区紀尾井町1-3"
  },
  "result": {
    "output": "東京都千代田区紀尾井町1-3",
    "score": 1,
    "match_level": "residential_detail",
    "lg_code": "131016",
    "pref": "東京都",
    "county": null,
    "city": "千代田区",
    "ward": null,
    "oaza_cho": "紀尾井町",
    "chome": null,
    "koaza": null,
    "machiaza_id": "0056000",
    "block": "1",
    "block_id": "001",
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
    "lon": 139.736394597
  }
}
```
  </details>

  <details>
    <summary><strong>geojson</strong>: GeoJSON形式で結果を出力します</summary>

```json
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
          "output": "東京都千代田区紀尾井町1-3",
          "score": 1,
          "other": null,
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
          "block": "1",
          "block_id": "001",
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
          "lon": 139.736394597
        }
      }
    }
  ]
}
```
  </details>


  <details>
    <summary><strong>ndgeojson</strong>: NdGeoJSON形式で結果を出力します</summary>

```json
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
      "output": "東京都千代田区紀尾井町1-3",
      "score": 1,
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
      "block": "1",
      "block_id": "001",
      "rsdt_num": 3,
      "rsdt_id": "003",
      "rsdt_num2": null,
      "rsdt2_id": null,
      "prc_num1": null,
      "prc_num2": null,
      "prc_num3": null,
      "prc_id": null
    }
  }
}
```
  </details>

## --fuzzy オプション

  `--fuzzy` の後ろに、任意の1文字を指定することで、ワイルドカードとして使う文字を変更することが出来ます。  
  省略された場合は `?` です。

  例:
  ```sh
  echo "東京都町?市森野2-2-22" | abrg - -f json --fuzzy "?"
  ```

## --target オプション

  ジオコーディングに用いるデータベースの対象を選択します。
  デフォルトでは、`住所表記`と`地番`の両方を使用します。

  | 値           | 説明                                |
  | :----------- | :----------------------------------|
  | all          | `住所表記`と`地番`の両方のデータを用いる |
  | residential  | `住所表記`データのみを用いる            |
  | parcel       | `地番`データのみを用いる               |
