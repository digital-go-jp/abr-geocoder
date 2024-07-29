import BetterSqlite3, { Statement } from "better-sqlite3";
import { LRUCache } from "lru-cache";
import fs from 'node:fs';
import stringHash from "string-hash";

export class Sqlite3Wrapper extends BetterSqlite3 {
  private readonly cache = new LRUCache<number, Statement<unknown[], unknown>>({
    max: 20,
  });

  constructor(params: Required<{
    schemaFilePath: string;
    sqliteFilePath: string;
    readonly: boolean,
  }>) {
    super(params.sqliteFilePath, {
      readonly: params.readonly,
    });

    const isExistSqliteFile = fs.statSync(params.sqliteFilePath).size !== 0;
    if (params.readonly) {
      this.pragma('journal_mode = OFF');
      this.pragma('synchronous = OFF');
    } else {
      // sqliteファイルがない場合、schemaFilePath のsqlを実行する
      if (!isExistSqliteFile) {
        const schemaSQL = fs.readFileSync(params.schemaFilePath, 'utf8');
        this.exec(schemaSQL);
      }
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