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
import { TableKeyProvider } from "@domain/services/table-key-provider";
import { Sqlite3Wrapper } from "../better-sqlite3-wrap";
import { IDatasetDb, UrlCache } from "@drivers/database/dataset-db";
import timers from 'node:timers/promises';

export class DatasetDbSqlite3 
  extends Sqlite3Wrapper
  implements IDatasetDb {
  async deleteUrlCache(url: URL): Promise<void> {
    const sql = `
        DELETE FROM
          ${DbTableName.DATASET}
        WHERE
          ${DataField.URL_KEY.dbColumn} = @url_key
      `;
    await this.createDatasetTable();

    this.prepare<{ url_key: string; }, unknown>(sql).run({
      url_key: TableKeyProvider.getUrlHashKey(url),
    });
  }
  async close(): Promise<void> {
    this.driver.close();
  }

  async readUrlCache(url: URL): Promise<UrlCache | undefined> {
    const sql = `
        SELECT
          ${DataField.URL_KEY.dbColumn} as url_key,
          ${DataField.FILE_URL.dbColumn} as url,
          ${DataField.ETAG.dbColumn} as etag,
          ${DataField.LAST_MODIFIED.dbColumn} as last_modified,
          ${DataField.CONTENT_LENGTH.dbColumn} as content_length,
          ${DataField.CRC32.dbColumn} as crc32
        FROM
          ${DbTableName.DATASET}
        WHERE
          ${DataField.URL_KEY.dbColumn} = @url_key
      `;
    await this.createDatasetTable();

    return Promise.resolve(
      this.prepare<{ url_key: string; }, UrlCache>(sql).get({
        url_key: TableKeyProvider.getUrlHashKey(url),
      }),
    );
  }

  async createDatasetTable() {
    this.driver.exec(`
        CREATE TABLE IF NOT EXISTS "${DbTableName.DATASET}" (
          "${DataField.URL_KEY.dbColumn}" TEXT PRIMARY KEY,
          "${DataField.FILE_URL.dbColumn}" TEXT,
          "${DataField.ETAG.dbColumn}" TEXT,
          "${DataField.LAST_MODIFIED.dbColumn}" TEXT,
          "${DataField.CONTENT_LENGTH.dbColumn}" NUMBER,
          "${DataField.CRC32.dbColumn}" TEXT
        );
      `);
  }
  
  // Datasetテーブルにデータを挿入する
  async saveUrlCache(urlCache: Omit<UrlCache, 'url_key'>) {
    const sql = `
        INSERT INTO ${DbTableName.DATASET} (
          ${DataField.URL_KEY.dbColumn},
          ${DataField.FILE_URL.dbColumn},
          ${DataField.ETAG.dbColumn},
          ${DataField.LAST_MODIFIED.dbColumn},
          ${DataField.CONTENT_LENGTH.dbColumn},
          ${DataField.CRC32.dbColumn}
        ) VALUES (
          @url_key,
          @url,
          @etag,
          @last_modified,
          @content_length,
          @crc32
        ) ON CONFLICT (${DataField.URL_KEY.dbColumn}) DO UPDATE SET
          ${DataField.FILE_URL.dbColumn} = @url,
          ${DataField.ETAG.dbColumn} = @etag,
          ${DataField.LAST_MODIFIED.dbColumn} = @last_modified,
          ${DataField.CONTENT_LENGTH.dbColumn} = @content_length,
          ${DataField.CRC32.dbColumn} = @crc32
        WHERE
          ${DataField.URL_KEY.dbColumn} = @url_key
      `;
  
    await this.createDatasetTable();
      
    while (true) {
      try {
        return await new Promise((resolve: (_?: void) => void) => {
          this.driver.transaction(() => {
            const url_key = TableKeyProvider.getUrlHashKey(urlCache.url);
            this.prepare(sql).run({
              url_key,
              url: urlCache.url.toString(),
              etag: urlCache.etag || '',
              last_modified: urlCache.last_modified || '',
              content_length: urlCache.content_length,
              crc32: urlCache.crc32,
            });
            resolve();
          })();
        });
      } catch (e: unknown) {
        if (e && typeof e === 'object' && 'code' in e && e.code === 'SQLITE_BUSY') {
          await timers.setTimeout(100);
        } else {
          throw e;
        }
      }
    }
  }
  
}
