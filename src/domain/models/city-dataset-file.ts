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
import { ICommonDbDownload } from '@drivers/database/common-db';
import { DataWithDateFile, IDatasetFileMeta, ProcessOptions } from './dataset-file';

export class CityDatasetFile
  extends DataWithDateFile
  implements IDatasetFileMeta {

  get fields(): DataField[] {
    return [
      DataField.LG_CODE,
      DataField.PREF,
      DataField.COUNTY,
      DataField.CITY,
      DataField.WARD,
    ];
  }

  async process(params: Omit<ProcessOptions, 'db'> & {db : ICommonDbDownload}) {
    let parsedRows = params.lines.map(row => this.parseCsv(row));
    if (this.lgCodeFilter && this.lgCodeFilter.size > 0) {
      const cache = new Map<string, boolean>();
      parsedRows = parsedRows.filter(row => {
        const lgCode = row[DataField.LG_CODE.dbColumn] as string;
        if (cache.has(lgCode)) {
          return cache.get(lgCode)!;
        }
        if (this.lgCodeFilter!.has(lgCode)) {
          cache.set(lgCode, true);
          return true;
        }
        const prefLevel = `${lgCode.substring(0, 2)}....`;
        const result = this.lgCodeFilter!.has(prefLevel);
        cache.set(lgCode, result);
        return result;
      });
    }
    
    // DBに取り込む
    await params.db.cityCsvRows(parsedRows);
  }

  // 市区町村マスター データセット
  static readonly CKAN_PACKAGE_ID = '000002';
}
