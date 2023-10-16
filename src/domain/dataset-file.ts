import { IStreamReady } from './istream-ready';

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
