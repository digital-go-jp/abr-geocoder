import { AbrgMessage } from './index';

const messages: Record<AbrgMessage, string> = {
  [AbrgMessage.CLI_COMMON_DATADIR_OPTION]:
    'The data directory where the dataset is stored. Default is under the (home)/.abr-geocoder/',
  [AbrgMessage.CLI_COMMON_RESOURCE_OPTION]:
    'The dataset ID of Address Base Repository. The default is `ba000001` which includes all dataset for overall Japan',
  [AbrgMessage.CLI_DOWNLOAD_DESC]: 'Downloads the latest dataset from origin',
  [AbrgMessage.CLI_DOWNLOAD_FORCE_DESC]:
    'Downloads the latest dataset from origin mandatory',
  [AbrgMessage.CLI_GEOCODE_DESC]:
    'Geocoding for the Japan addresses in the given file',
  [AbrgMessage.CLI_GEOCODE_FUZZY_OPTION]:
    'Treats a given character as wildcard matching',
  [AbrgMessage.CLI_GEOCODE_INPUT_FILE]:
    "The path for the file which formatted Japanese address each line. Reads from stdin when you give '-'.",
  [AbrgMessage.CLI_GEOCODE_OUTPUT_FILE]:
    'The path for the output file. If omit, print out to stdout.',
  [AbrgMessage.CLI_GEOCODE_FORMAT_OPTION]: "Output format. Default is 'csv'.",
  [AbrgMessage.APPLICATION_DESC]:
    'Address Base Registry Geocoder provided by Japan Digital Agency',
  [AbrgMessage.CLI_UPDATE_CHECK_DESC]: 'Check the availavility for the dataset',
  [AbrgMessage.ERROR_NO_UPDATE_IS_AVAILABLE]: 'The current dataset is latest.',
  [AbrgMessage.CHECKING_UPDATE]: 'Checking update...',
  [AbrgMessage.START_DOWNLOADING_NEW_DATASET]:
    'Start downloading the new dataset',
  [AbrgMessage.EXTRACTING_THE_DATA]: 'Extracting the data...',
  [AbrgMessage.LOADING_INTO_DATABASE]: 'Loading into the database...',
  [AbrgMessage.NEW_DATASET_IS_AVAILABLE]:
    'New dataset has been found. Please update the local dataset using `abrg download`.',
  [AbrgMessage.DATA_DOWNLOAD_ERROR]: 'Failed to download the dataset',
  [AbrgMessage.CANNOT_FIND_THE_SPECIFIED_RESOURCE]:
    'Can not find the specified resource',
  [AbrgMessage.DOWNLOADED_DATA_DOES_NOT_CONTAIN_THE_RESOURCE_CSV]:
    'Specified resource does not contain the data csv file',
  [AbrgMessage.START_DOWNLOADING]: 'Download start',
  [AbrgMessage.CANNOT_FIND_INPUT_FILE]: 'Can not open the source file',
  [AbrgMessage.INPUT_SOURCE_FROM_STDIN_ERROR]:
    "'-' is for only reading input from stdin",
  [AbrgMessage.UNSUPPORTED_OUTPUT_FORMAT]:
    'Specified output format is not available',
};
export default messages;
