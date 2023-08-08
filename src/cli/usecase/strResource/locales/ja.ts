import { MESSAGE } from "./index";

const messages: Record<MESSAGE, string> = {
  [MESSAGE.CLI_COMMON_DATADIR_OPTION]: "アドレス・ベース・レジストリのデータを格納するディレクトリを指定する。指定されていない場合はデフォルトのディレクトリを参照します。",
  [MESSAGE.CLI_COMMON_SOURCE_OPTION]: "アドレス・ベース・レジストリのデータソースID。全国データは `ba000001` をお使いください。",
  [MESSAGE.CLI_DOWNLOAD_DESC]: "アドレス・ベース・レジストリの最新データをCKANからダウンロードする",
  [MESSAGE.CLI_GEOCODE_DESC]: "指定されたファイルに含まれる日本の住所を緯度経度に変換します",
  [MESSAGE.CLI_GEOCODE_FUZZY_OPTION]: "指定した1文字をワイルドカードとして処理します",
  [MESSAGE.CLI_GEOCODE_INPUT_FILE]: "緯度経度に変換したい住所を1行ごとに記入したファイルへのパス",
  [MESSAGE.CLI_GEOCODE_FORMAT_OPTION]: "出力フォーマットを指定します。デフォルトは'text'",
  [MESSAGE.APPLICATION_DESC]: "デジタル庁：アドレス・ベース・レジストリを用いたジオコーダー",
  [MESSAGE.CLI_UPDATE_CHECK_DESC]: "データセットのアップデートを確認します",
  [MESSAGE.ERROR_NO_UPDATE_IS_AVAILABLE]: '現状データが最新です。更新を中断します。',
  [MESSAGE.CHECKING_UPDATE]: "アップデートの確認中...",
  [MESSAGE.START_DOWNLOADING_NEW_DATASET]: "ダウンロード開始",
  [MESSAGE.EXTRACTING_THE_DATA]: 'ファイルを展開中...',
  [MESSAGE.LOADING_INTO_DATABASE]: 'データベースに登録中...',
  [MESSAGE.NEW_DATASET_IS_AVAILABLE]: "ローカルのデータが更新できます。 abrg download で更新してください",
  [MESSAGE.DATA_DOWNLOAD_ERROR]: "データの取得に失敗しました",
  [MESSAGE.CANNOT_FIND_THE_SPECIFIED_RESOURCE]: "指定されたリソースが見つかりませんでした",
  [MESSAGE.DOWNLOADED_DATA_DOES_NOT_CONTAIN_THE_RESOURCE_CSV]: "指定されたリソースには、CSVファイルが含まれていませんでした",
  [MESSAGE.START_DOWNLOADING]: "ダウンロード開始",
};
export default messages;