import { IDatasetFile, IDatasetFileMeta } from "@domain/dataset-file";
import { IStreamReady } from "@domain/istream-ready";

export class RsdtdspRsdtPosFile implements IDatasetFile {
  sql: string = 'RsdtdspRsdtPosFile sql'
  fileArea: string = 'pref01';
  path: string = 'somewhere';
  filename: string = 'mt_rsdtdsp_rsdt_pos_pref01.csv';
  type: string = 'rsdtdsp_rsdt_pos';
  
  constructor(
    public csvFile: IStreamReady,
  ) {}

  process(row: { [key: string]: string }): Record<string, string | number> {
    return row;
  }

  static create = jest.fn().mockImplementation((params: IDatasetFileMeta, csvFile: IStreamReady) => {
    return new RsdtdspRsdtPosFile(csvFile);
  })
}