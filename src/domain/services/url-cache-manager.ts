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
import fs from 'node:fs';
import path from 'node:path';
import { deserialize, serialize } from "node:v8";

export type UrlCache = {
  key: string;
  url: string;
  etag?: string;
  cache_file: string;
  last_modified?: string;
  content_length: number;
  crc32: number;
};

export class UrlCacheManager {

  constructor(public readonly cacheDir: string) {}

  async readCache(params: {
    key: string;
  }): Promise<UrlCache | undefined> {
    const cacheFilePath = path.join(this.cacheDir, `${params.key}.bin`);
    const isExist = fs.existsSync(cacheFilePath);
    if (!isExist) {
      return;
    }
    try {
      const encoded = await fs.promises.readFile(cacheFilePath);
      return deserialize(encoded) as UrlCache | undefined;
    } catch (e: unknown) {
      // Do nothing here
      return undefined;
    }
  }

  async writeCache(cache: UrlCache) {
    const cacheFilePath = path.join(this.cacheDir, `${cache.key}.bin`);
    const buffer = serialize(cache);
    await fs.promises.writeFile(cacheFilePath, buffer);
  }
  async deleteCache(cache: UrlCache) {
    const cacheFilePath = path.join(this.cacheDir, `${cache.key}.bin`);
    const buffer = serialize(cache);
    await fs.promises.writeFile(cacheFilePath, buffer);
  }
}