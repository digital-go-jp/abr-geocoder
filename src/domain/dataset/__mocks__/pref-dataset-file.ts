import { IDatasetFile, IDatasetFileMeta } from "@domain/dataset-file";
import { Stream } from 'stream';
import { DummyCsvFile } from "./dummy-csv.skip";
import { IStreamReady } from "@domain/istream-ready";

export class PrefDatasetFile implements IDatasetFile {
  sql: string = 'PrefDatasetFile sql'
  fileArea: string = 'all';
  path: string = 'somewhere';
  filename: string = 'mt_pref_all.csv';
  type: string = 'pref';

  constructor(
    public csvFile: IStreamReady,
  ) {}

  process(row: { [key: string]: string }): Record<string, string | number> {
    return row;
  }

  static readonly create = jest.fn().mockImplementation((params: IDatasetFileMeta, csvFile: IStreamReady) => {
    return new PrefDatasetFile(csvFile);
  })
}