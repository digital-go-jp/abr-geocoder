import { Database } from 'better-sqlite3';

export const saveKeyAndValue = ({
  db,
  key,
  value,
}: {
  db: Database;
  key: string;
  value: string;
}) => {
  db.prepare('insert or replace into metadata values(@key, @value)').run({
    key,
    value,
  });
};
