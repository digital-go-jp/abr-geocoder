/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
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
import { getSystemLocale } from './get-system-locale';
import i18next from 'i18next';

export enum AbrgMessage {
  CLI_COMMON_DATADIR_OPTION = 'CLI_COMMON_WORKDIR_OPTION',
  CLI_COMMON_RESOURCE_OPTION = 'CLI_COMMON_SOURCE_OPTION',

  CLI_UPDATE_CHECK_DESC = 'CLI_UPDATE_CHECK_DESC',
  CLI_DOWNLOAD_DESC = 'CLI_DOWNLOAD_DESC',
  CLI_DOWNLOAD_FORCE_DESC = 'CLI_DOWNLOAD_FORCE_DESC',

  CLI_GEOCODE_DESC = 'CLI_GEOCODE_DESC',
  CLI_GEOCODE_FUZZY_OPTION = 'CLI_GEOCODE_FUZZY_OPTION',
  CLI_GEOCODE_INPUT_FILE = 'CLI_GEOCODE_INPUT_FILE',
  CLI_GEOCODE_OUTPUT_FILE = 'CLI_GEOCODE_OUTPUT_FILE',
  CLI_GEOCODE_FORMAT_OPTION = 'CLI_GEOCODE_FORMAT_OPTION',
  APPLICATION_DESC = 'APPLICATION_DESC',
  ERROR_NO_UPDATE_IS_AVAILABLE = 'ERROR_NO_UPDATE_IS_AVAILABLE',
  CHECKING_UPDATE = 'CHECKING_UPDATE',
  START_DOWNLOADING_NEW_DATASET = 'START_DOWNLOADING_NEW_DATASET',
  EXTRACTING_THE_DATA = 'EXTRACTING_THE_DATA',
  FINDING_THE_DATASET_FILES = 'FINIDING_THE_DATASET_FILES',
  LOADING_INTO_DATABASE = 'LOADING_INTO_DATABASE',
  NEW_DATASET_IS_AVAILABLE = 'NEW_DATASET_IS_AVAILABLE',
  DATA_DOWNLOAD_ERROR = 'DATA_DOWNLOAD_ERROR',
  CANNOT_FIND_THE_SPECIFIED_RESOURCE = 'CANNOT_FIND_THE_SPECIFIED_RESOURCE',
  DOWNLOADED_DATA_DOES_NOT_CONTAIN_THE_RESOURCE_CSV = 'DOWNLOADED_DATA_DOES_NOT_CONTAIN_THE_RESOURCE_CSV',
  START_DOWNLOADING = 'START_DOWNLOADING',
  CANNOT_FIND_INPUT_FILE = 'CANNOT_FIND_INPUT_FILE',
  CANNOT_FIND_SQL_FILE = 'CANNOT_FIND_SQL_FILE',
  CANNOT_FIND_PACKAGE_JSON_FILE = 'CANNOT_FIND_PACKAGE_JSON_FILE',
  INPUT_SOURCE_FROM_STDIN_ERROR = 'INPUT_SOURCE_FROM_STDIN_ERROR',
  UNSUPPORTED_OUTPUT_FORMAT = 'UNSUPPORTED_OUTPUT_FORMAT',
  PROMPT_CONTINUE_TO_DOWNLOAD = 'PROMPT_CONTINUE_TO_DOWNLOAD',
  DOWNLOAD_ERROR = 'DOWNLOAD_ERROR',
}

export namespace AbrgMessage {
  i18next.init({
    fallbackLng: 'en',
    resources: {
      en: {
        translation: require('./locales/en').default,
      },
      ja: {
        translation: require('./locales/ja').default,
      },
    },
  });

  const locale = getSystemLocale();
  let originalTranslater = i18next.getFixedT(locale);

  export function setLocale(locale: 'en' | 'ja') {
    originalTranslater = i18next.getFixedT(locale);
  }

  export function toString(messageId: AbrgMessage): string {
    return originalTranslater(messageId);
  }
}
