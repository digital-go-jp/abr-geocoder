import { Database } from 'better-sqlite3';

export const getValueWithKey = ({
  db,
  key,
}: {
  db: Database;
  key: string;
}): string | undefined => {
  const result = db
    .prepare('select value from metadata where key = @key limit 1')
    .get({
      key,
    }) as
    | {
        value: string;
      }
    | undefined;
  if (!result) {
    return;
  }
  return result.value;
};
