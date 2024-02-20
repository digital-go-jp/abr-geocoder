import { IDatasetFile, IDatasetFileMeta } from "@domain/dataset-file";
import { IStreamReady } from "@domain/istream-ready";

export class TownDatasetFile implements IDatasetFile {
  sql: string = 'TownDatasetFile sql'
  fileArea: string = 'all';
  path: string = 'somewhere';
  filename: string = 'mt_town_all.csv';
  type: string = 'town';
  
  constructor(
    public csvFile: IStreamReady,
  ) {}

  process(row: { [key: string]: string }): Record<string, string | number> {
    return row;
  }

  static readonly create = jest.fn().mockImplementation((params: IDatasetFileMeta, csvFile: IStreamReady) => {
    return new TownDatasetFile(csvFile);
  })
}