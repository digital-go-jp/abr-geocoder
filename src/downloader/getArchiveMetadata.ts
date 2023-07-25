import {ArchiveMetadata, IArchiveMeta} from '../types';
import type BetterSqlite3 from 'better-sqlite3';

export const getArchiveMetadata = ({
  db,
}: {
  db: BetterSqlite3.Database;
}): ArchiveMetadata => {
  const allMetadata = db
    .prepare('SELECT "key", "value" FROM "metadata"')
    .all() as IArchiveMeta[];

  const result: ArchiveMetadata = {};
  allMetadata.forEach((row: IArchiveMeta) => {
    result[row.key] = row.value;
  });

  return result;
};
