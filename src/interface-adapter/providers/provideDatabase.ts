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
