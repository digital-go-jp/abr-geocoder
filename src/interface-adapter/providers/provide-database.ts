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
import type BetterSqlite3 from 'better-sqlite3';
import Database from 'better-sqlite3';
import fs from 'node:fs';

export const provideDatabase = async ({
  sqliteFilePath,
  schemaFilePath,
}: {
  sqliteFilePath: string;
  schemaFilePath: string;
}): Promise<BetterSqlite3.Database> => {
  const schemaSQL = await fs.promises.readFile(schemaFilePath, 'utf8');
  const db = new Database(sqliteFilePath);

  // We use these dangerous settings to improve performance, because if data is corrupted,
  // we can always just regenerate the database.
  // ref: https://qastack.jp/programming/1711631/improve-insert-per-second-performance-of-sqlite
  db.pragma('journal_mode = MEMORY');
  db.pragma('synchronous = OFF');
  db.exec(schemaSQL);
  return db;
};
