/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { DataField } from '@config/data-field';
import { ICommonDbDownload, IParcelDbDownload, IRsdtBlkDbDownload, IRsdtDspDbDownload } from '@drivers/database/common-db';
import proj4 from 'proj4';
import crc32 from '../services/crc32-lib';
import { FileGroup2Key, FileGroupKey } from '../types/download/file-group';
import { ICsvFile } from '../types/download/icsv-file';
import { PrefLgCode } from '../types/pref-lg-code';

export interface IDatasetFileMeta {
  type: FileGroupKey;
  type2: FileGroup2Key;
  path: string;
  lgCode: string;
  filename: string;
  prefLgCode: PrefLgCode;
}

proj4.defs('EPSG:4612', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');
proj4.defs('EPSG:6668', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');

export type DatasetParams = {
  fileMeta: IDatasetFileMeta;
  csvFile: ICsvFile;
  lgCodeFilter?: Set<string>;
};

export type CsvLine = { [key: string]: string };

export type ProcessOptions = {
  lines: CsvLine[];
  db: ICommonDbDownload | IRsdtBlkDbDownload | IRsdtDspDbDownload | IParcelDbDownload;
};

export abstract class DatasetFile implements IDatasetFileMeta {
  public readonly type: FileGroupKey;
  public readonly type2: FileGroup2Key;
  public readonly lgCode: string;
  public readonly csvFile: ICsvFile;
  public readonly path: string;
  public readonly filename: string;
  public readonly prefLgCode: PrefLgCode;
  protected lgCodeFilter: Set<string> | undefined;
  
  abstract get fields(): DataField[];

  constructor(params: DatasetParams) {
    this.type = params.fileMeta.type;
    this.type2 = params.fileMeta.type2;
    this.lgCode = params.fileMeta.lgCode;
    this.path = params.fileMeta.path;
    this.filename = params.fileMeta.filename;
    this.prefLgCode = params.fileMeta.prefLgCode;
    this.csvFile = params.csvFile;
    this.lgCodeFilter = params.lgCodeFilter;
  }

  // CSVファイルの1行のデータを分析して、データベースに反映させる
  abstract process(params: ProcessOptions): Promise<void>;

  // CSVファイルを1行のデータを、必要な項目だけ読み込んで返す
  protected parseCsv(
    line: CsvLine,
  ): Record<string, string | number>  {
    const result: Record<string, string | number> = {};
    this.fields.forEach(field => {
      result[field.dbColumn] = line[field.csv];
    });

    // 与えられたデータからパラメータのcrc32 を計算する
    result.crc32 = crc32.fromRecord(result);
    return result;
  }
}

export abstract class DataWithDateFile
  extends DatasetFile
  implements IDatasetFileMeta
{

}

export abstract class DataForPosFile
  extends DatasetFile
  implements IDatasetFileMeta
{

  override parseCsv(
    csvLine: CsvLine,
  ): Record<string, string | number>  {
    const parsedRow = super.parseCsv(csvLine);

    // 座標系の変換
    const lat = parseFloat(parsedRow[DataField.REP_LAT.dbColumn] as string);
    const lon = parseFloat(parsedRow[DataField.REP_LON.dbColumn] as string);

    if (!parsedRow[DataField.REP_SRID.csv]) {
      throw new Error(`${parsedRow[DataField.REP_SRID.csv]} is required`);
    }

    // 代表点_座標参照系
    const extra = parsedRow[DataField.REP_SRID.csv].toString();
    const [longitude, latitude] = proj4(
      extra, // from
      'WGS84', // to
    ).forward([lon, lat]);

    parsedRow[DataField.REP_LON.dbColumn] = longitude;
    parsedRow[DataField.REP_LAT.dbColumn] = latitude;

    return parsedRow;
  }

}
