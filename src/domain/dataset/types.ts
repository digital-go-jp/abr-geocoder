export interface IDatasetFileMeta {
  fileArea: string;
  path: string;
  filename: string;
  type: string;
}

export interface IDatasetFile extends IDatasetFileMeta {
  sql: string;
  inputStream: NodeJS.ReadableStream;
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
