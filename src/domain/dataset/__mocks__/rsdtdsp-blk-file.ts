import { IDatasetFile, IDatasetFileMeta } from "@domain/dataset-file";
import { IStreamReady } from "@domain/istream-ready";

export class RsdtdspBlkFile implements IDatasetFile {
  sql: string = 'RsdtdspBlkFile sql'
  fileArea: string = 'pref01';
  path: string = 'somewhere';
  filename: string = 'mt_rsdtdsp_blk_pref01.csv';
  type: string = 'rsdtdsp_blk';
  
  constructor(
    public csvFile: IStreamReady,
  ) {}

  process(row: { [key: string]: string }): Record<string, string | number> {
    return row;
  }

  static create = jest.fn().mockImplementation((params: IDatasetFileMeta, csvFile: IStreamReady) => {
    return new RsdtdspBlkFile(csvFile);
  })
}