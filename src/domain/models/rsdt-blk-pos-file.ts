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
import { IRsdtBlkDbDownload } from '@drivers/database/common-db';
import { DataForPosFile, IDatasetFileMeta, ProcessOptions } from './dataset-file';

export class RsdtdspBlkPosFile
  extends DataForPosFile
  implements IDatasetFileMeta {

  get fields(): DataField[] {
    return [
      DataField.LG_CODE,
      DataField.REP_LAT,
      DataField.REP_LON,
      DataField.MACHIAZA_ID,
      DataField.BLK_ID,
      DataField.BLK_NUM,
      DataField.REP_SRID,
    ];
  }
  
  async process(params: Omit<ProcessOptions, 'db'> & {db : IRsdtBlkDbDownload}) {
    const parsedRows = params.lines.map(row => this.parseCsv(row));
    // DBに取り込む
    await params.db.rsdtBlkPosCsvRows(parsedRows);
  }
  
  // 街区マスター位置参照拡張 データセット
  static readonly CKAN_PACKAGE_ID = '000007';
}
