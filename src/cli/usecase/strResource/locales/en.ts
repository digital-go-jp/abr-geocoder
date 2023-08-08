import { MESSAGE } from "./index";

const messages: Record<MESSAGE, string> = {
  [MESSAGE.CLI_COMMON_DATADIR_OPTION]: "The data directory where the dataset is stored. Default is under the (home)/.abr-geocoder/",
  [MESSAGE.CLI_COMMON_SOURCE_OPTION]: "The dataset ID of Address Base Repository. The default is `ba000001` which includes all dataset for overall Japan",
  [MESSAGE.CLI_DOWNLOAD_DESC]: "Downloads the latest dataset from origin",
  [MESSAGE.CLI_GEOCODE_DESC]: "Geocoding for the Japan addresses in the given file",
  [MESSAGE.CLI_GEOCODE_FUZZY_OPTION]: "Treats a given character as wildcard matching",
  [MESSAGE.CLI_GEOCODE_INPUT_FILE]: "The path for the file which formatted Japanese address each line",
  [MESSAGE.CLI_GEOCODE_FORMAT_OPTION]: "Output format. Default is 'text'.",
  [MESSAGE.APPLICATION_DESC]: "Address Base Registry Geocoder provided by Japan Digital Agency",
  [MESSAGE.CLI_UPDATE_CHECK_DESC]: "Check the availavility for the dataset",
  [MESSAGE.ERROR_NO_UPDATE_IS_AVAILABLE]: "The current dataset is latest.",
  [MESSAGE.CHECKING_UPDATE]: 'Checking update...',
  [MESSAGE.START_DOWNLOADING_NEW_DATASET]: 'Start downloading the new dataset',
  [MESSAGE.EXTRACTING_THE_DATA]: 'Extracting the data...',
  [MESSAGE.LOADING_INTO_DATABASE]: 'Loading into the database...',
  [MESSAGE.NEW_DATASET_IS_AVAILABLE]: "New dataset has been found. Please update the local dataset using `abrg download`.",
  [MESSAGE.DATA_DOWNLOAD_ERROR]: "Failed to download the dataset",
  [MESSAGE.CANNOT_FIND_THE_SPECIFIED_RESOURCE]: "Can not find the specified resource",
  [MESSAGE.DOWNLOADED_DATA_DOES_NOT_CONTAIN_THE_RESOURCE_CSV]: "Specified resource does not contain the data csv file",
  [MESSAGE.START_DOWNLOADING]: "Download start",
};
export default messages;