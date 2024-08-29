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
import { DataField } from "@config/data-field";
import { DbTableName } from "@config/db-table-name";
import { PackageInfo } from "@domain/services/parse-package-id";
import { TableKeyProvider } from "@domain/services/table-key-provider";
import { ICommonDbUpdateCheck } from "@interface/database/common-db";
import { Sqlite3Wrapper } from "@interface/database/sqlite3/better-sqlite3-wrap";
export class CommonDbUpdateCheckSqlite3 
  extends Sqlite3Wrapper
  implements ICommonDbUpdateCheck {

  async closeDb(): Promise<void> {
    Promise.resolve(this.close());
  }

  getLgCodes(): Promise<string[]> {
    type Row = {
      lg_code: string;
    };

    const rows = this.prepare<unknown[], Row>(`
      SELECT
        ${DataField.LG_CODE.dbColumn} as lg_code
      FROM
        ${DbTableName.CITY}
    `).all();
    const results = rows.map((row: Row) => row.lg_code);
    return Promise.resolve(results);
  }

  hasPrefRows(): Promise<boolean> {
    type Row = {
      count: number;
    };

    const row = this.prepare<unknown[], Row>(`
      SELECT
        count(pref_key) as count
      FROM
        ${DbTableName.PREF}
      LIMIT 1
    `).get();
    return Promise.resolve(row?.count !== 0);
  }

  hasCityRows(packageInfo: PackageInfo): Promise<boolean> {
    type Row = {
      count: number;
    };

    const city_key = TableKeyProvider.getCityKey({
      lg_code: packageInfo.lgCode,
    });

    const row = this.prepare<{
      city_key: number;
    }, Row>(`
      SELECT
        count(city_key) as count
      FROM
        ${DbTableName.CITY}
      WHERE
        city_key = @city_key
      LIMIT 1
    `).get({
      city_key,
    });
    return Promise.resolve(row?.count !== 0);
  }

  hasTownRows(packageInfo: PackageInfo): Promise<boolean> {
    type Row = {
      count: number;
    };

    const city_key = TableKeyProvider.getCityKey({
      lg_code: packageInfo.lgCode,
    });

    const row = this.prepare<{
      city_key: number;
    }, Row>(`
      SELECT
        count(city_key) as count
      FROM
        ${DbTableName.TOWN}
      WHERE
        city_key = @city_key
      LIMIT 1
    `).get({
      city_key,
    });
    return Promise.resolve(row?.count !== 0);
  }
}
