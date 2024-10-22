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
import BetterSqlite3, { Statement } from "better-sqlite3";
import { LRUCache } from "lru-cache";
import stringHash from "string-hash";

export class Sqlite3Wrapper extends BetterSqlite3 {
  private readonly cache = new LRUCache<number, Statement<unknown[], unknown>>({
    max: 20,
  });

  constructor(params: Required<{
    sqliteFilePath: string;
    readonly: boolean,
  }>) {
    super(params.sqliteFilePath, {
      readonly: params.readonly,
    });

    if (params.readonly) {
      this.pragma('journal_mode = OFF');
      this.pragma('synchronous = OFF');
    } else {
      this.pragma('journal_mode = WAL');
    }
    this.pragma('cache_size = -20000');
    this.pragma('threads = SQLITE_DEFAULT_WORKER_THREADS');

  }

  prepare<P extends unknown[] | {} = unknown[], R = unknown>(sql: string) {
    const key = stringHash(sql);
    if (this.cache.has(key)) {
      return this.cache.get(key) as Statement<P, R>;
    }
    const statement = super.prepare<P, R>(sql);
    this.cache.set(key, statement);
    return statement;
  }
}
