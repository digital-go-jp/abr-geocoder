import { IDatasetFile, IDatasetFileMeta } from "@domain/dataset-file";
import { IStreamReady } from "@domain/istream-ready";

export class TownPosDatasetFile implements IDatasetFile {
  sql: string = 'TownPosDatasetFile sql'
  fileArea: string = 'pref01';
  path: string = 'somewhere';
  filename: string = 'mt_town_pos_pref01.csv';
  type: string = 'town_pos';
  
  constructor(
    public csvFile: IStreamReady,
  ) {}

  process(row: { [key: string]: string }): Record<string, string | number> {
    return row;
  }

  static readonly create = jest.fn().mockImplementation((params: IDatasetFileMeta, csvFile: IStreamReady) => {
    return new TownPosDatasetFile(csvFile);
  })
}