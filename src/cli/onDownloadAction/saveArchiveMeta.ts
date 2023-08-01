import {Database} from 'better-sqlite3';
import {DatasetMetadata} from '../../types';

export const saveArchiveMeta = ({
  db,
  meta,
}: {
  db: Database;
  meta: DatasetMetadata;
}) => {
  const metaStmt = db.prepare(
    'INSERT OR REPLACE INTO "metadata" ("key", "value") VALUES (?, ?)'
  );
  // Insert metadata at the end of the run
  metaStmt.run('last_modified', meta.lastModified);
  metaStmt.run('original_file_url', meta.fileUrl);
};
