/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
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
import {
  DatasetFileParams,
  IDatasetFile,
  IDatasetFileMeta,
} from '@domain/dataset-file';
import { IStreamReady } from '@domain/istream-ready';
import proj4 from 'proj4';
import { DataField } from './data-field';

proj4.defs('EPSG:4612', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');
proj4.defs('EPSG:6668', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');

export abstract class DatasetFile implements IDatasetFile {
  public readonly type: string;
  public readonly fileArea: string;
  public readonly path: string;
  public readonly filename: string;
  public readonly sql: string;
  public readonly csvFile: IStreamReady;

  abstract get fields(): DataField[];

  protected constructor(params: DatasetFileParams) {
    this.type = params.type;
    this.fileArea = params.fileArea;
    this.path = params.path;
    this.filename = params.filename;
    this.sql = params.sql;
    this.csvFile = params.csvFile;
  }

  abstract process(rows: {
    [key: string]: string;
  }): Record<string, string | number>;

  // CSVのフィールド名をDBカラム名に変換する
  parseFields(row: { [key: string]: string }): Record<string, string | number> {
    const result: Record<string, string | number> = {};
    this.fields.forEach(field => {
      result[field.dbColumn] = row[field.csv] as string;
    });
    return result;
  }
}
export abstract class DataWithDateFile
  extends DatasetFile
  implements IDatasetFileMeta
{
  process(row: { [key: string]: string }): Record<string, string | number> {
    return this.parseFields(row);
  }
}

export abstract class DataForPosFile
  extends DatasetFile
  implements IDatasetFileMeta
{
  process(row: { [key: string]: string }): Record<string, string | number> {
    const parsedRow = this.parseFields(row);

    // 座標系の変換
    const lat = parseFloat(parsedRow[DataField.REP_PNT_LAT.dbColumn] as string);
    const lon = parseFloat(parsedRow[DataField.REP_PNT_LON.dbColumn] as string);
    const extra = row['rep_srid'];
    try {
      const [longitude, latitude] = proj4(
        extra, // from
        'WGS84' // to
      ).forward([lon, lat]);

      parsedRow[DataField.REP_PNT_LON.dbColumn] = longitude;
      parsedRow[DataField.REP_PNT_LAT.dbColumn] = latitude;

      return parsedRow;
    } catch (e) {
      console.error(e);
      return parsedRow;
    }
  }
}
