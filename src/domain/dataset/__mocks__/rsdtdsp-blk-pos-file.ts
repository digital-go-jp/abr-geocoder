import { IDatasetFile, IDatasetFileMeta } from "@domain/dataset-file";
import { IStreamReady } from "@domain/istream-ready";

export class RsdtdspBlkPosFile implements IDatasetFile {
  sql: string = 'RsdtdspBlkPosFile sql'
  fileArea: string = 'pref01';
  path: string = 'somewhere';
  filename: string = 'mt_rsdtdsp_blk_pos_pref01.csv';
  type: string = 'rsdtdsp_blk_pos';
  
  constructor(
    public csvFile: IStreamReady,
  ) {}

  process(row: { [key: string]: string }): Record<string, string | number> {
    return row;
  }

  static readonly create = jest.fn().mockImplementation((params: IDatasetFileMeta, csvFile: IStreamReady) => {
    return new RsdtdspBlkPosFile(csvFile);
  })
}