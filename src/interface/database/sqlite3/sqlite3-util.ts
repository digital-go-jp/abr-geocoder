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