import { IStreamReady } from '..';
import { DatasetMetadata } from './DatasetMetadata';

export type ArchiveMetadata = {
  // last_modified: string;
  [key: string]: string | number;
};

export type CheckForUpdatesOutput = {
  updateAvailable: boolean;
  meta: DatasetMetadata;
};

export type CKANResponse<T> =
  | {
      success: false;
    }
  | {
      success: true;
      result: T;
    };

export type CKANPackageShow = {
  id: string;
  title: string;
  resources: CKANPackageResource[];
};

export type CKANPackageResource = {
  description: string;
  last_modified: string;
  id: string;
  url: string;
  format: string;
};

export interface IArchiveMeta {
  key: string;
  value: string | number;
}

export interface IDatasetFileMeta {
  fileArea: string;
  path: string;
  filename: string;
  type: string;
}

export interface IDatasetFile extends IDatasetFileMeta {
  sql: string;
  csvFile: IStreamReady;
}

export type DatasetFileParams = IDatasetFile;

export interface CsvPrefRow {
  code: string;
  pref_name: string;
  pref_name_kana: string;
  pref_name_roma: string;
  efct_date: string;
  ablt_date: string;
  remarks: string;
}
