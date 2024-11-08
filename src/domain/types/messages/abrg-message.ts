/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import i18next from 'i18next';
import { getSystemLocale } from './get-system-locale';

/**
 * メッセージを表示するための定数
 */
export enum AbrgMessage {
  CLI_UPDATE_CHECK_DESC = 'CLI_UPDATE_CHECK_DESC',
  CANNOT_GET_PACKAGE_LIST = 'CANNOT_GET_PACKAGE_LIST',
  CLI_COMMON_DATADIR_OPTION = 'CLI_COMMON_WORKDIR_OPTION',
  CLI_COMMON_DEBUG_OPTION = 'CLI_COMMON_DEBUG_OPTION',
  CLI_COMMON_SILENT_OPTION = 'CLI_COMMON_SILENT_OPTION',
  NO_UPDATE_IS_AVAILABLE = 'NO_UPDATE_IS_AVAILABLE',
  CLI_SERVE_DESC = 'CLI_SERVE_DESC',
  CANNOT_OPEN_THE_DATABASE = 'CANNOT_OPEN_THE_DATABASE',
  UPDATE_IS_AVAILABLE = 'UPDATE_IS_AVAILABLE',
  PROMPT_CONTINUE_TO_DOWNLOAD = 'PROMPT_CONTINUE_TO_DOWNLOAD',
  CLI_YES_FOR_DOWNLOAD_IF_UPDATE_IS_AVAILABLE = 'CLI_YES_FOR_DOWNLOAD_IF_UPDATE_IS_AVAILABLE',
  CLI_NO_FOR_DOWNLOAD_IF_UPDATE_IS_AVAILABLE = 'CLI_NO_FOR_DOWNLOAD_IF_UPDATE_IS_AVAILABLE',
  CLI_DOWNLOAD_DESC = 'CLI_DOWNLOAD_DESC',
  CLI_DOWNLOAD_TARGET_LGCODES = 'CLI_DOWNLOAD_TARGET_LGCODES',
  CLI_GEOCODE_DESC = 'CLI_GEOCODE_DESC',
  CLI_GEOCODE_TARGET_OPTION = 'CLI_GEOCODE_TARGET_OPTION',
  CLI_GEOCODE_FUZZY_OPTION = 'CLI_GEOCODE_FUZZY_OPTION',
  CLI_GEOCODE_FUZZY_CHAR_ERROR = 'CLI_GEOCODE_FUZZY_CHAR_ERROR',
  CLI_GEOCODE_FORMAT_OPTION = 'CLI_GEOCODE_FORMAT_OPTION',
  CLI_GEOCODE_INPUT_FILE = 'CLI_GEOCODE_INPUT_FILE',
  CANNOT_FIND_INPUT_FILE = 'CANNOT_FIND_INPUT_FILE',
  CANNOT_FIND_PACKAGE_JSON_FILE = 'CANNOT_FIND_PACKAGE_JSON_FILE',
  INPUT_SOURCE_FROM_STDIN_ERROR = 'INPUT_SOURCE_FROM_STDIN_ERROR',
  UNSUPPORTED_OUTPUT_FORMAT = 'UNSUPPORTED_OUTPUT_FORMAT',
  CLI_GEOCODE_OUTPUT_FILE = 'CLI_GEOCODE_OUTPUT_FILE',
  CLI_SERVE_PORT_OPTION = 'CLI_SERVE_PORT_OPTION',
  CANNOT_FIND_THE_ROOT_DIR = 'CANNOT_FIND_THE_ROOT_DIR',
  NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
}

const enMessages: Record<AbrgMessage, string> = {
  [AbrgMessage.CLI_SERVE_DESC]: 'Serve the geocodng functionality as REST api',
  [AbrgMessage.CLI_UPDATE_CHECK_DESC]: 'Check the availavility for the dataset',
  [AbrgMessage.CANNOT_GET_PACKAGE_LIST]: 'Can not get package list from the server',
  [AbrgMessage.CLI_COMMON_DATADIR_OPTION]: 'The data directory where the dataset is stored. Default is under the (home)/.abr-geocoder/',
  [AbrgMessage.CLI_COMMON_DEBUG_OPTION]: 'Output debug information',
  [AbrgMessage.CLI_COMMON_SILENT_OPTION]: 'Hide progress bar',
  [AbrgMessage.NO_UPDATE_IS_AVAILABLE]: 'The current datasets are latest. No update is available',
  [AbrgMessage.CANNOT_OPEN_THE_DATABASE]: 'Can not open the database.',
  [AbrgMessage.UPDATE_IS_AVAILABLE]: 'new datasets are available({num_of_update}).',
  [AbrgMessage.PROMPT_CONTINUE_TO_DOWNLOAD]: 'Continue to download?',
  [AbrgMessage.CLI_YES_FOR_DOWNLOAD_IF_UPDATE_IS_AVAILABLE]: 'Yes for downloading if update is available',
  [AbrgMessage.CLI_NO_FOR_DOWNLOAD_IF_UPDATE_IS_AVAILABLE]: 'No for downloading if update is available',
  [AbrgMessage.CLI_DOWNLOAD_DESC]: 'Downloads the latest datasets from the server',
  [AbrgMessage.CLI_DOWNLOAD_TARGET_LGCODES]: 'Specify the LGCodes for the regions from which to download the dataset, separated by spaces',
  [AbrgMessage.CLI_GEOCODE_DESC]: 'Geocoding for the Japan addresses in the given file',
  [AbrgMessage.CLI_GEOCODE_TARGET_OPTION]: "Search target. Default is 'all'.",
  [AbrgMessage.CLI_GEOCODE_FUZZY_OPTION]: 'Treats a given character as wildcard matching',
  [AbrgMessage.CLI_GEOCODE_FUZZY_CHAR_ERROR]: '--fuzzy option accepts only a single character',
  [AbrgMessage.CLI_GEOCODE_FORMAT_OPTION]: "Output format. Default is 'json'.",
  [AbrgMessage.CLI_GEOCODE_INPUT_FILE]: "The path for the file which formatted Japanese address each line. Reads from stdin when you give '-'.",
  [AbrgMessage.CANNOT_FIND_INPUT_FILE]: 'Can not open the source file',
  [AbrgMessage.INPUT_SOURCE_FROM_STDIN_ERROR]: "'-' is for only reading input from stdin",
  [AbrgMessage.UNSUPPORTED_OUTPUT_FORMAT]: 'Specified output format is not available',
  [AbrgMessage.CANNOT_FIND_PACKAGE_JSON_FILE]: 'Can not file the required file "package.json"',
  [AbrgMessage.CLI_GEOCODE_OUTPUT_FILE]: 'The path for the output file. If omit, print out to stdout.',
  [AbrgMessage.CLI_SERVE_PORT_OPTION]: 'The port number for rest api',
  [AbrgMessage.CANNOT_FIND_THE_ROOT_DIR]: 'Can not find the root directory',
  [AbrgMessage.NOT_IMPLEMENTED]: 'Not implemented',
};
const jaMessages: Record<AbrgMessage, string> = {
  [AbrgMessage.CLI_SERVE_DESC]: 'REST apiサーバーとしてジオコーディング機能を提供します',
  [AbrgMessage.CLI_UPDATE_CHECK_DESC]: 'データセットのアップデートを確認します',
  [AbrgMessage.CANNOT_GET_PACKAGE_LIST]: 'サーバーからパッケージのリストを取得できませんでした',
  [AbrgMessage.CLI_COMMON_DATADIR_OPTION]: 'データを格納するディレクトリを指定します。デフォルトは (home)/.abr-geocoder です',
  [AbrgMessage.CLI_COMMON_DEBUG_OPTION]: 'デバッグ情報を出力します',
  [AbrgMessage.CLI_COMMON_SILENT_OPTION]: 'プログレスバーを表示しません',
  [AbrgMessage.NO_UPDATE_IS_AVAILABLE]: '利用可能な更新データはありません',
  [AbrgMessage.CANNOT_OPEN_THE_DATABASE]: 'データベースに接続できません',
  [AbrgMessage.UPDATE_IS_AVAILABLE]: '利用可能な更新データ({num_of_update})があります。',
  [AbrgMessage.PROMPT_CONTINUE_TO_DOWNLOAD]: '続けてデータをダウンロードしますか？',
  [AbrgMessage.CLI_YES_FOR_DOWNLOAD_IF_UPDATE_IS_AVAILABLE]: '利用可能な更新データがあるとき、続けてダウンロードします',
  [AbrgMessage.CLI_NO_FOR_DOWNLOAD_IF_UPDATE_IS_AVAILABLE]: '利用可能な更新データがあっても、何もしないで、更新チェックを終了します',
  [AbrgMessage.CLI_DOWNLOAD_DESC]: 'アドレス・ベース・レジストリの最新データをダウンロードします',
  [AbrgMessage.CLI_DOWNLOAD_TARGET_LGCODES]: 'データセットをダウンロードする地域を指定するLGCodeを、空白区切りで指定します',
  [AbrgMessage.CLI_GEOCODE_DESC]: '指定されたファイルに含まれる日本の住所を緯度経度に変換します',
  [AbrgMessage.CLI_GEOCODE_TARGET_OPTION]: "検索ターゲットを指定します。デフォルトは'all'",
  [AbrgMessage.CLI_GEOCODE_FUZZY_OPTION]: '指定した1文字をワイルドカードとして処理します',
  [AbrgMessage.CLI_GEOCODE_FUZZY_CHAR_ERROR]: '--fuzzy オプションは1文字のみを受け付けます。',
  [AbrgMessage.CLI_GEOCODE_FORMAT_OPTION]: "出力フォーマットを指定します。デフォルトは'json'",
  [AbrgMessage.CLI_GEOCODE_INPUT_FILE]: "日本の住所を1行ごとに記入したテキストファイルへのパス。'-'を指定すると、標準入力から読み取ります",
  [AbrgMessage.CANNOT_FIND_INPUT_FILE]: '入力ファイルが見つかりませんでした',
  [AbrgMessage.INPUT_SOURCE_FROM_STDIN_ERROR]: "inputFile='-' は標準入力から読み取るときに指定します",
  [AbrgMessage.UNSUPPORTED_OUTPUT_FORMAT]: 'サポートされていない出力形式が指定されました',
  [AbrgMessage.CANNOT_FIND_PACKAGE_JSON_FILE]: '"package.json"ファイルが見つかりませんでした',
  [AbrgMessage.CLI_GEOCODE_OUTPUT_FILE]: '出力するファイルのパス。省略すると、標準出力に出力します。',
  [AbrgMessage.CLI_SERVE_PORT_OPTION]: 'REST apiのためのポート番号',
  [AbrgMessage.CANNOT_FIND_THE_ROOT_DIR]: 'ルートディレクトリを見つけることが出来ませんでした',
  [AbrgMessage.NOT_IMPLEMENTED]: '実装されていません',
};


i18next.init({
  fallbackLng: 'en',
  resources: {
    en: {
      translation: enMessages,
    },
    ja: {
      translation: jaMessages,
    },
  },
});

const locale = getSystemLocale();
let originalTranslater = i18next.getFixedT(locale);

export namespace AbrgMessage {

  /**
   * 言語設定を設定します。
   * @param locale 言語設定
   */
  export function setLocale(locale: 'en' | 'ja') {
    originalTranslater = i18next.getFixedT(locale);
  }

  /**
   * メッセージを取得します。
   * @param messageId メッセージID
   * @returns メッセージ
   */
  export function toString(messageId: AbrgMessage, others?: { [key: string] : number | string}): string {
    let message = originalTranslater(messageId);
    if (others) {
      Object.keys(others).forEach(key => {
        message = message.replaceAll('{' + key + '}', others[key].toString());
      });
    }
    
    return message;
  }
}
