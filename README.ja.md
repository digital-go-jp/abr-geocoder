# abr-geocoder (デジタル庁 アドレス・ベース・レジストリ ジオコーダー)

- [English version](./README.md)

## 説明

  入力した住所文字列とデジタル庁が整備する [アドレス・ベース・レジストリ](https://catalog.registries.digital.go.jp/rc/dataset/)を突合し、正規化された住所文字列・町字 ID ・緯度経度等を出力するジオコーダーです。
  日本国内の住所表記を分析し、揺れを吸収して、階層に合わせて正規化した結果を出力します。

  ![](https://lp.geocoder.address-br.digital.go.jp/assets/2024072820391722166771.png)

## 特徴

  - 日本国内の住所を対象としたジオコーダ
  - [アドレス・ベース・レジストリ](https://catalog.registries.digital.go.jp/rc/dataset/)に基づいて住所表記、階層に合わせて正規化
  - `住居表示` と `地番` に対応。
  - SQLiteを使用。サーバー内でジオコーディングすることが可能。
  - マルチスレッドによる高速処理。
  - `csv`, `json`, `geojson`, `ndjson`, `ndgeojson`, `simplified` の6つの出力形式をサポート。

## ユースケース

  - コマンドとして利用可能
    - 標準入力・標準出力によるパイプライン
    - ファイルによる入出力
  - RESTサーバとして利用可能
  - Node.jsのライブラリとして利用可能
    - 個別リクエスト、Streamをサポート

## できないこと

  - ランドマーク（有名な施設名など）による検索
  - 郵便番号による検索
  - アルファベット（英語表記）による検索
  - 京都の通り名による検索（※一部対応）
  - 不完全な住所表記による検索

## インストール

  - グローバルインストール
  ```sh
  npm install -g @digital-go-jp/abr-geocoder
  npm link
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

## `abrg serve`コマンド

  ジオコーダをREST APIサーバーとして起動します。

  ```sh
  abrg serve [options]
  ```

  - <details>
    <summary>ポート番号の変更</summary>

    REST APIサーバーのポート番号を変更します。デフォルトは `3000` です。

    ```sh
    abrg serve -p 8080
    ```
  </details>

  - <details>
    <summary>ディレクトリの変更</summary>

    データベースを保存するディレクトリを指定します。デフォルトでは `$HOME/.abr-geocoder` です。

    ```sh
    abrg serve  -d (データを保存するディレクトリへのパス)
    ```
  </details>
