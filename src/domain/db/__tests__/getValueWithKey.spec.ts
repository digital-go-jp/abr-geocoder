import { describe, expect, it, jest } from '@jest/globals';
import { default as BetterSqlite3, default as Database } from 'better-sqlite3';
import { getValueWithKey } from '../getValueWithKey';

jest.mock<BetterSqlite3.Database>('better-sqlite3');
jest.mock('string-hash')

const MockedDB = Database as unknown as jest.Mock;

describe("getValueWithKey()", () => {
  it.concurrent("should return expected value", async () => {
    MockedDB.mockImplementation(() => {
      return {
        prepare: (sql: string) => {
          return {
            get: (key: number): { [key: string]: string } | undefined => {
              return {
                key: 'ba000001',
                value: '1234',
              }
            },
          };
        },
      };
    });
    const mockedDB = new Database('<no sql file>');
    
    const receivedValue = getValueWithKey({
      db: mockedDB,
      key: 'ba000001',
    });

    expect(receivedValue).toEqual('1234');
  });
  it.concurrent("should return ", async () => {

    MockedDB.mockImplementation(() => {
      return {
        prepare: (sql: string) => {
          return {
            get: (key: number): { [key: string]: string } | undefined => {
              return undefined
            },
          };
        },
      };
    });
    const mockedDB = new Database('<no sql file>');
    
    const receivedValue = getValueWithKey({
      db: mockedDB,
      key: 'ba000001',
    });

    expect(receivedValue).toBe(undefined);
  });
});