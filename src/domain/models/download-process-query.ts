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

import { FileGroupKey } from "../types/download/file-group";
import { ICsvFile } from "../types/download/icsv-file";
import { CityDatasetFile } from "./city-dataset-file";
import { CityPosDatasetFile } from "./city-pos-dataset-file";
import { IDatasetFileMeta } from "./dataset-file";
import { ParcelDatasetFile } from "./parcel-dataset-file";
import { ParcelPosDatasetFile } from "./parcel-pos-dataset-file";
import { PrefDatasetFile } from "./pref-dataset-file";
import { PrefPosDatasetFile } from "./pref-pos-dataset-file";
import { RsdtdspBlkFile } from "./rsdt-blk-file";
import { RsdtdspBlkPosFile } from "./rsdt-blk-pos-file";
import { RsdtDspFile } from "./rsdt-dsp-file";
import { RsdtDspPosFile } from "./rsdt-dsp-pos-file";
import { TownDatasetFile } from "./town-dataset-file";
import { TownPosDatasetFile } from "./town-pos-dataset-file";

export enum DownloadProcessStatus {
  ERROR = 'error',
  SUCCESS = 'success',
  UNSET = 'unset',
}

export type DownloadProcessBase = {
  status: DownloadProcessStatus
};

export type DownloadRequest = {
  kind: 'download';
  lgCode: string;
  dataset: FileGroupKey;
  useCache?: boolean;
  packageId: string;
};
export type CommandRequest<T> = {
  kind: 'command';
  data: T;
};

export type DownloadQueryBase = 
  DownloadRequest &
  DownloadProcessBase;

export type DownloadQuery1 = DownloadQueryBase;

export type DownloadProcessError = {
  message: string;
} & DownloadQueryBase;

export type DownloadQuery2 = {
  csvFilePath: string;
  noUpdate: boolean;
} & DownloadQueryBase;

export type DownloadResult = {
  csvFiles: ICsvFile[];
} & DownloadQueryBase;

export const isDownloadProcessError = (target: DownloadProcessBase): target is DownloadProcessError => {
  return target.status === DownloadProcessStatus.ERROR;
};

export type CsvLoadRequest = {
  dataset: FileGroupKey;
};

export type CsvLoadQueryBase = DownloadProcessBase & CsvLoadRequest;

export type CsvLoadQuery2 = {
  files: {
    fileMeta: IDatasetFileMeta;
    csvFile: ICsvFile,
    datasetFile: PrefDatasetFile | CityDatasetFile | PrefPosDatasetFile | CityPosDatasetFile | TownDatasetFile | TownPosDatasetFile | RsdtdspBlkFile | RsdtdspBlkPosFile | RsdtDspFile | RsdtDspPosFile | ParcelDatasetFile | ParcelPosDatasetFile
  }[]
} & CsvLoadQueryBase;

export type CsvLoadResult = {
  kind: 'result';
} & CsvLoadQueryBase;
