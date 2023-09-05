import { run } from 'node:test';
import { saveArchiveMeta } from '../saveArchiveMeta';
import Database from 'better-sqlite3';

const dummyStatement = jest.fn();
jest.mock('better-sqlite3', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    return {
      prepare: jest.fn().mockImplementation(() => {
        return {
          run: dummyStatement,
        };
      }),
    };
  }),
}));

describe('saveArchiveMeta', () => {
  it('should work correctly', () => {
    const db = new Database(':memory:');

    saveArchiveMeta({
      db,
      meta: {
        fileUrl: 'fileUrl_test',
        lastModified: 'lastModified_test',
      },
    });

    expect(Database).toHaveBeenCalledTimes(1);
    expect(db.prepare).toBeCalledWith(
      'INSERT OR REPLACE INTO "metadata" ("key", "value") VALUES (?, ?)'
    );

    const statement = db.prepare('');
    expect(statement.run).nthCalledWith(
      1,
      'last_modified',
      'lastModified_test'
    );
    expect(statement.run).nthCalledWith(2, 'original_file_url', 'fileUrl_test');
  });
});
