import {Database} from 'better-sqlite3';
import {DatasetMetadata} from './types';

export interface saveArchiveMetaParams {
  db: Database;
  meta: DatasetMetadata;
}
export const saveArchiveMeta = ({
  db,
  meta,
}: saveArchiveMetaParams) => {
  const metaStmt = db.prepare(
    'INSERT OR REPLACE INTO "metadata" ("key", "value") VALUES (?, ?)'
  );
  // Insert metadata at the end of the run
  metaStmt.run('last_modified', meta.lastModified);
  metaStmt.run('original_file_url', meta.fileUrl);
};
