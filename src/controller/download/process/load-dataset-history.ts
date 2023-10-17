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
import { DatasetRow } from '@domain/dataset/dataset-row';
import { Database } from 'better-sqlite3';

export const loadDatasetHistory = async ({
  db,
}: {
  db: Database;
}): Promise<Map<string, DatasetRow>> => {
  const rows = db.prepare('select * from dataset').all() as {
    key: string;
    type: string;
    content_length: number;
    crc32: number;
    last_modified: number;
  }[];

  const results = new Map<string, DatasetRow>();

  rows.forEach(row => {
    results.set(
      row.key,
      new DatasetRow({
        key: row.key,
        type: row.type,
        contentLength: row.content_length,
        crc32: row.crc32,
        lastModified: row.last_modified,
      })
    );
  });

  return results;
};
