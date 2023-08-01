import fs from 'node:fs';
import type BetterSqlite3 from "better-sqlite3";
import Database from "better-sqlite3";

export const createDatabase = async ({
  sqlitePath,
  schemaPath,
}: {
  sqlitePath: string,
  schemaPath: string,
}): Promise<BetterSqlite3.Database> => {
  const db = new Database(sqlitePath);
  const exist = fs.existsSync(sqlitePath);
  db.exec(await fs.promises.readFile(schemaPath, 'utf8'));

  // We use these dangerous settings to improve performance, because if data is corrupted,
  // we can always just regenerate the database.
  // ref: https://qastack.jp/programming/1711631/improve-insert-per-second-performance-of-sqlite
  db.pragma('journal_mode = MEMORY');
  db.pragma('synchronous = OFF');
  return db;
}