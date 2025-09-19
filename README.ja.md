# abr-geocoder (デジタル庁 アドレス・ベース・レジストリ ジオコーダー)

- [English version](./README.md)

## 🚀 Version 3.0 の新機能

- `abrg reverse` コマンドで逆ジオコーディングに対応しました
- REST APIサーバー `/reverse` エンドポイントで逆ジオコーディングに対応しました

## 🚨 Version 2.2 から Version 2.2.1 へのアップグレード

- データセットダウンロード用の新しいDCAT形式APIに対応しました。
- **既知の問題**: `abrg update-check`コマンドは新しいAPI形式にまだ対応しておらず、正しく動作しません。今後Version3へのアップデートを予定しているため、Version2での対応は未定です。

## 🚨 Version 2.1 から Version 2.2 へのアップグレード

- `abrg serve`コマンドは、`abrg serve start`と `abrg serve stop`コマンドになりました


## 説明

  入力した住所文字列とデジタル庁が整備する [アドレス・ベース・レジストリ](https://catalog.registries.digital.go.jp/rc/dataset/)を突合し、正規化された住所文字列・町字 ID ・緯度経度等を出力するジオコーダーです。
  日本国内の住所表記を分析し、揺れを吸収して、階層に合わせて正規化した結果を出力します。

  ![](https://lp.geocoder.address-br.digital.go.jp/assets/2024072820391722166771.png)

## 特徴

  - 日本国内の住所を対象としたジオコーダ・逆ジオコーダ
  - [アドレス・ベース・レジストリ](https://catalog.registries.digital.go.jp/rc/dataset/)に基づいて住所表記、階層に合わせて正規化
  - `住居表示` と `地番` に対応。
  - SQLiteを使用。サーバー内でジオコーディングすることが可能。
  - マルチスレッドによる高速処理。
  - `csv`, `json`, `geojson`, `ndjson`, `ndgeojson`, `simplified` の6つの出力形式をサポート。

## ユースケース

  - コマンドとして利用可能
    - 標準入力・標準出力によるパイプライン
    - ファイルによる入出力
    - 座標指定による逆ジオコーディング
  - RESTサーバとして利用可能
    - ジオコーディング: `/geocode`
    - 逆ジオコーディング: `/reverse`
  - Node.jsのライブラリとして利用可能
    - 個別リクエスト、Streamをサポート
  - 京都の通り名による検索（※一部未対応）

## できないこと

  - ランドマーク（有名な施設名など）による検索
  - 郵便番号による検索
  - アルファベット（英語表記）による検索

## インストール

  - グローバルインストール
  ```sh
  npm install -g @digital-go-jp/abr-geocoder
  abrg  # 実行できることを確認
  ```

  - ローカルインストール 
  ```sh
  npm install @digital-go-jp/abr-geocoder
  npm link
  abrg  # 実行できることを確認
  ```

## `abrg download`コマンド

  [アドレス・ベース・レジストリ](https://catalog.registries.digital.go.jp/rc/dataset/)からジオコーディングに必要なデータセットをダウンロードし、SQLiteを使ってデータベースを構築します。

  ```sh
  abrg download [options]
  ```

  - <details>
    <summary>地域を指定してダウンロード</summary>

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

  - <details>
    <summary>ディレクトリの変更</summary>

    データセットファイルをダウンロードしたり、データベースを保存するディレクトリを変更することができます。
    デフォルトでは `$HOME/.abr-geocoder` に保存します。

    ```sh
    abrg download -d (データを保存するディレクトリへのパス)
    ```
  </details>

  - <details>
    <summary>プログレスバーを非表示</summary>
    silentオプションを指定すると、プログレスバーを表示しません。

    ```sh
    abrg download --silent
    ```
  </details>

  - <details>
    <summary>デバッグ情報の表示</summary>
    処理が完了したとき、処理に掛かった時間を表示します。

    ```sh
    abrg download --debug
    ```
  </details>

## `abrg update-check`コマンド

  データのアップデートを確認します。ローカルにデータがある場合は、データベースに含まれる市区町村を対象にアップデートチェックを行ないます。新しいデータがある場合には、続けてダウンロードすることが可能です。

  ```sh
  abrg update-check [options]
  ```

  - <details>
    <summary>yes/no を事前に指定</summary>
    利用可能な更新データがある場合、続けてダウンロードを行うかどうかを事前に指定しておくことができます。

    ```sh
    # 続けてダウンロードを行う場合
    abrg update-check --yes

    # 続けてダウンロードを行わない場合
    abrg update-check --no
    ```
  </details>

  - <details>
    <summary>プログレスバーを非表示</summary>
    silentオプションを指定すると、プログレスバーを表示しません。

    ```sh
    abrg update-check --silent
    ```
  </details>

  - <details>
    <summary>ディレクトリの変更</summary>

    データベースを保存するディレクトリを指定します。デフォルトでは `$HOME/.abr-geocoder` です。

    ```sh
    abrg update-check -d (データを保存するディレクトリへのパス)
    ```
  </details>

  - <details>
    <summary>デバッグ情報の表示</summary>
    処理が完了したとき、処理に掛かった時間を表示します。

    ```sh
    abrg update-check --debug
    ```
  </details>

## `abrg`コマンド

  入力した住所文字列をデータベースと突合し、正規化された住所文字列・町字 ID・緯度経度等を出力します。
  (ジオコーディングを行います。)

  ```
  $ abrg <inputFile> [<outputFile>] [options]
  ```

  - `<inputFile>`
    
    コマンドにデータを入力する方法を指定します。

    - <details>
      <summary>ファイルへのパスを指定した場合</summary>
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
      </details>

    - <details>
      <summary>"-" を指定した場合</summary>
      標準入力からデータを受け取ります。

      例：
      ```
      echo "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階" | abrg -
      ```
      </details>
      

  - `<outputFile>`
  
    処理結果の出力先を指定します。省略された場合は標準出力(stdout)に出力されます。

    - <details>
      <summary>ファイルへのパスを指定した場合</summary>
      指定されたファイルに処理結果を出力します。出力形式は `--format` オプションに基づきます。

      例：
      ```
      abrg ./input.txt ./output.json
      ```
      </details>

    - <details>
      <summary>省略した場合</summary>
      省略された場合は標準出力(stdout)に出力されます。

      例：
      ```
      cat ./sample.txt | abrg - | jq
      ```
      </details>
      
  - <details>
    <summary>出力形式の変更</summary>
    
    `-f`, `--format` オプションで出力書式を変更できます。デフォルトは`json`です。

    | format     | 説明                                                           |
    |------------|---------------------------------------------------------------|
    | csv        | カンマ区切りのcsv形式で結果を出力します                             |
    | simplified | 出力フィールドを限定した、カンマ区切りのcsv形式で結果を出力します        |
    | json       | JSON形式で結果を出力します                                        |
    | ndjson     | NDJSON形式で結果を出力します                                      |
    | geojson    | GeoJSON形式で結果を出力します                                     |
    | ndgeojson  | NDGeoJSON形式で結果を出力します                                   |

    </details>

  - <details>
    <summary>ワイルドカード文字を指定する</summary>
    任意の1文字をワイルドカードとして扱うことができます。
    utf-8で表現できない旧漢字などを●（黒丸）などに変換した場合などに、指定すると便利です。デフォルトは`?`です。

    例:
    ```
    echo "東京都町●市森野2-2-22" | abrg - --fuzzy "●"
    ```
    </details>

  - <details>
    <summary>プログレスバーを非表示</summary>
    silentオプションを指定すると、プログレスバーを表示しません。

    ```sh
    abrg ./input.txt ./output.txt --silent
    ```
  </details>

  - <details>
    <summary>ディレクトリの変更</summary>

    データベースを保存するディレクトリを指定します。デフォルトでは `$HOME/.abr-geocoder` です。

    ```sh
    abrg ./input.txt ./output.txt  -d (データを保存するディレクトリへのパス)
    ```
  </details>

  - <details>
    <summary>デバッグ情報の表示</summary>
    処理が完了したとき、処理に掛かった時間を表示します。
    また入力された住所文字列にマッチした各テーブルの主キーの情報が出力されます。

    ```sh
    abrg ./input.txt ./output.txt --debug
    ```
  </details>

  - <details>
    <summary>ジオコーディング対象</summary>
    
    `--target` オプションで住居表示・地番のジオコーディング対象を変更できます。デフォルトは`all`です。

    | format      | 説明                                                         |
    |-------------|-------------------------------------------------------------|
    | all         | 住居表示と地番のデータの両方を調べます。住居表示の結果が優先されます    |
    | residential | 住居表示データのみを調べます                                     |
    | parcel      | 地番データのみを調べます                                        |

    </details>

## `abrg reverse`コマンド

  座標（緯度・経度）をデータベースと突合し、日本の住所を出力します。
  （逆ジオコーディングを行います。）

  ```
  $ abrg reverse <inputFile> [<outputFile>] [options]
  または
  $ abrg reverse --lat <緯度> --lon <経度> [options]
  ```

  - `<inputFile>`

    コマンドにデータを入力する方法を指定します。

    - <details>
      <summary>ファイルへのパスを指定した場合</summary>
      指定されたCSVファイルを逆ジオコーディングします。
      CSVファイルは `lat,lon,description` の形式で記入してください。

      例：
      ```
      abrg reverse ./coordinates.csv
      ```

      coordinates.csv
      ```csv
      lat,lon,description
      35.676543,139.770203,東京駅周辺
      35.689592,139.701171,新宿駅周辺
      35.658034,139.701636,渋谷駅周辺
      ```
      </details>

    - <details>
      <summary>"-" を指定した場合</summary>
      標準入力からデータを受け取ります。

      例：
      ```
      echo "lat,lon,description
      35.679107,139.736395,テスト地点" | abrg reverse -
      ```
      </details>

    - <details>
      <summary>--lat/--lon オプションを指定した場合</summary>
      単一の座標を直接指定して逆ジオコーディングします。

      例：
      ```
      abrg reverse --lat 35.679107172 --lon 139.736394597
      ```
      </details>


  - `<outputFile>`

    処理結果の出力先を指定します。省略された場合は標準出力(stdout)に出力されます。

    - <details>
      <summary>ファイルへのパスを指定した場合</summary>
      指定されたファイルに処理結果を出力します。出力形式は `--format` オプションに基づきます。

      例：
      ```
      abrg reverse ./coordinates.csv ./output.json
      ```
      </details>

    - <details>
      <summary>省略した場合</summary>
      省略された場合は標準出力(stdout)に出力されます。

      例：
      ```
      cat ./coordinates.csv | abrg reverse - | jq
      ```
      </details>

  - <details>
    <summary>出力形式の変更</summary>

    `-f`, `--format` オプションで出力書式を変更できます。デフォルトは`geojson`です。

    | format     | 説明                                                           |
    |------------|---------------------------------------------------------------|
    | csv        | カンマ区切りのcsv形式で結果を出力します                             |
    | simplified | 出力フィールドを限定した、カンマ区切りのcsv形式で結果を出力します        |
    | json       | JSON形式で結果を出力します                                        |
    | ndjson     | NDJSON形式で結果を出力します                                      |
    | geojson    | GeoJSON形式で結果を出力します                                     |
    | ndgeojson  | NDGeoJSON形式で結果を出力します                                   |

    </details>

  - <details>
    <summary>結果数の制限</summary>
    `-l`, `--limit` オプションで返却する結果の最大数を指定できます。デフォルトは`1`です。

    例:
    ```
    abrg reverse --lat 35.679107 --lon 139.736395 --limit 3
    ```
    </details>

  - <details>
    <summary>検索アルゴリズムの選択</summary>
    デフォルトでは空間インデックス（R木）を使用した高速検索を行います。

    ```sh
    # 空間インデックスを使用（高速、デフォルト）
    abrg reverse coordinates.csv --spatialIndex

    # ハヴァーサイン公式を使用
    abrg reverse coordinates.csv --haversine
    ```
    </details>

  - <details>
    <summary>プログレスバーを非表示</summary>
    silentオプションを指定すると、プログレスバーを表示しません。

    ```sh
    abrg reverse ./coordinates.csv ./output.txt --silent
    ```
  </details>

  - <details>
    <summary>ディレクトリの変更</summary>

    データベースを保存するディレクトリを指定します。デフォルトでは `$HOME/.abr-geocoder` です。

    ```sh
    abrg reverse ./coordinates.csv ./output.txt  -d (データを保存するディレクトリへのパス)
    ```
  </details>

  - <details>
    <summary>デバッグ情報の表示</summary>
    処理が完了したとき、処理に掛かった時間を表示します。

    ```sh
    abrg reverse ./coordinates.csv ./output.txt --debug
    ```
  </details>

  - <details>
    <summary>逆ジオコーディング対象</summary>

    `--target` オプションで住居表示・地番の逆ジオコーディング対象を変更できます。デフォルトは`all`です。

    | format      | 説明                                                         |
    |-------------|-------------------------------------------------------------|
    | all         | 住居表示と地番のデータの両方を調べます。住居表示の結果が優先されます    |
    | residential | 住居表示データのみを調べます                                     |
    | parcel      | 地番データのみを調べます                                        |

    </details>


## `abrg serve start`コマンド

  ジオコーダをREST APIサーバーとして起動します。

  ```sh
  abrg serve start [options]
  ```

  リクエスト方法

  ```sh
  # ジオコーディング（住所から座標）
  curl http://localhost:3000/geocode?address=東京都千代田区紀尾井町1-3
  
  # 🆕 逆ジオコーディング（座標から住所）
  curl "http://localhost:3000/reverse?lat=35.679107172&lon=139.736394597&limit=1"
  ```

  - <details>
    <summary>ポート番号の変更</summary>

    REST APIサーバーのポート番号を変更します。デフォルトは `3000` です。

    ```sh
    abrg serve start -p 8080
    ```
  </details>

  - <details>
    <summary>ディレクトリの変更</summary>

    データベースを保存するディレクトリを指定します。デフォルトでは `$HOME/.abr-geocoder` です。

    ```sh
    abrg serve start -d (データを保存するディレクトリへのパス)
    ```
  </details>

  - <details>
    <summary>リクエスト・パラメータ</summary>

    HTTP/GETでリクエストを行います。以下のパラメータが指定可能です。

    | パラメータ    | 必須 | 説明                                      |
    |-------------|-------------------------------------------------|
    | address     |   Y  | ジオコーディングしたい住所文字列。必須パラメータ |
    | target      |      | 検索対象(all, residentaial, parcel)       |
    | format      |      | 結果の出力形式                             |
    | fuzzy       |      | ワイルドカードとして使用する1文字             |

  </details>

## `abrg serve stop`コマンド

  ジオコーダをREST APIサーバーを終了します

  ```sh
  abrg serve stop
  ```

