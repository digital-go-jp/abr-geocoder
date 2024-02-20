import { IDatasetFile, IDatasetFileMeta } from "@domain/dataset-file";
import { Stream } from 'stream';
import { DummyCsvFile } from "./dummy-csv.skip";
import { IStreamReady } from "@domain/istream-ready";

export class CityDatasetFile implements IDatasetFile {
  sql: string = 'CityDatasetFile sql'
  fileArea: string = 'all';
  path: string = 'somewhere';
  filename: string = 'mt_city_all.csv';
  type: string = 'city';
  constructor(
    public csvFile: IStreamReady,
  ) {}

  process(row: { [key: string]: string }): Record<string, string | number> {
    return row;
  }
  
  static readonly create = jest.fn().mockImplementation((params: IDatasetFileMeta, csvFile: IStreamReady) => {
    return new CityDatasetFile(csvFile);
  })
}