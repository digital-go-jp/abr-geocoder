import { Database } from "better-sqlite3";
import {DatasetMetadata} from '..';
import stringHash from "string-hash";

export const getValueWithKey = ({
  db,
  key,
}: {
  db: Database,
  key: string
}): DatasetMetadata | undefined => {
  const result = db
    .prepare(
      `select value from metadata where key = @key limit 1`
    )
    .get({
      key: stringHash(key),
    }) as
    | {
        value: string;
      }
    | undefined;
  if (!result) {
    return;
  }
  return DatasetMetadata.from(result.value);
}