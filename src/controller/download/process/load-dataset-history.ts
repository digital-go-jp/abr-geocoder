import { Database } from 'better-sqlite3';
import { DatasetRow} from '../../../domain/';

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
