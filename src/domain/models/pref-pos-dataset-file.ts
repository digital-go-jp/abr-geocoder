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
import { ICommonDbDownload } from '@interface/database/common-db';
import { DataForPosFile, DatasetParams, IDatasetFileMeta, ProcessOptions } from './dataset-file';

export class PrefPosDatasetFile
  extends DataForPosFile
  implements IDatasetFileMeta {

  get fields(): DataField[] {
    return [
      DataField.LG_CODE,
      DataField.REP_LAT,
      DataField.REP_LON,
      DataField.REP_SRID,
    ];
  }
  
  constructor(params: DatasetParams) {
    if (params.lgCodeFilter && params.lgCodeFilter.size > 0) {
      // prefの場合は先頭2文字だけで良い
      const lgCodeFilter = new Set<string>();
      for (const lgCode of params.lgCodeFilter.values()) {
        lgCodeFilter.add(lgCode.substring(0, 2));
      }
      params.lgCodeFilter = lgCodeFilter;
    }
    super(params);
  }
  
  async process(params: Omit<ProcessOptions, 'db'> & {db : ICommonDbDownload}) {
    let parsedRows = params.lines.map(row => this.parseCsv(row));
    if (this.lgCodeFilter && this.lgCodeFilter.size > 0) {
      // 都道府県の場合、先頭2文字が一致すれば良い
      parsedRows = parsedRows.filter(row => {
        const lgCode = row[DataField.LG_CODE.dbColumn] as string;
        return this.lgCodeFilter!.has(lgCode.substring(0, 2));
      });
    }

    const lgCodes = new Set<string>();
    parsedRows.forEach(row => {
      lgCodes.add(row[DataField.LG_CODE.dbColumn] as string);
    });
    
    // DBに取り込む
    if (!params.noUpdate) {
      await params.db.prefPosCsvRows(parsedRows);
    }

    return lgCodes;
  }

  // 都道府県マスター位置参照拡張 データセット
  static readonly CKAN_PACKAGE_ID = '000012';
}
