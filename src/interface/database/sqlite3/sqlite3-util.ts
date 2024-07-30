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
import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { LRUCache } from "lru-cache";
import fs from 'node:fs';
import path from 'node:path';

export class Sqlite3Util {
  constructor(private readonly params: Required<{
    dataDir: string;
  }>) {
    // SQLite3 の場合はローカルにファイルを作成するので、ディレクトリが無ければ作成する
    makeDirIfNotExists(this.params.dataDir);
  }

  private readonly cache: LRUCache<string, boolean> = new LRUCache({
    max: 30
  });

  hasExtraDb(params: Required<{
    lg_code: string;
  }>): boolean {
    if (!fs.existsSync(this.params.dataDir)) {
      this.cache.set(params.lg_code, false);
      return false;
    }
    if (this.cache.has(params.lg_code)) {
      return this.cache.get(params.lg_code)!;
    }

    const result = fs.existsSync(path.join(this.params.dataDir, `abrg-${params.lg_code}.sqlite`));
    this.cache.set(params.lg_code, result);
    return result;
  }
}