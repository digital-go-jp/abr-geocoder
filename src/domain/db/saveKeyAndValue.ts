import { Database } from "better-sqlite3";
import {DatasetMetadata} from '..';
import stringHash from "string-hash";

export const saveKeyAndValue = ({
  db,
  key,
  value,
}: {
  db: Database;
  key: string;
  value: DatasetMetadata;
}) => {
  db.prepare(
    `insert or replace into metadata values(@key, @value)`
  ).run({
    key: stringHash(key),
    value: value.toString(),
  });
}