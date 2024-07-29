
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