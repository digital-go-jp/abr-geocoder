import { describe, expect, it, jest } from '@jest/globals';
import { default as BetterSqlite3, default as Database } from 'better-sqlite3';
import stringHash from "string-hash";
import { getValueWithKey } from '../getValueWithKey';

jest.mock<BetterSqlite3.Database>('better-sqlite3');
jest.mock('string-hash')

const MockedDB = Database as unknown as jest.Mock;

const mockedStringHash = stringHash as jest.MockedFunction<(args0: string) => number>;
mockedStringHash.mockImplementation((key: string): number => {
  if (key === 'key1') {
    return 12345;
  } else {
    return 67890;
  }
});

describe("getValueWithKey()", () => {
  it.concurrent("should return expected value", async () => {
    const expectedValue = {
      lastModified: 'Thu, 29 Jun 2023 20:03:24 GMT',
      etag: '"85a3b4aefbe07aad6ef6da7a17d87dd4-60"',
      contentLength: 503120257,
      fileUrl: 'https://catalog.registries.digital.go.jp/rsc/address/address_all.csv.zip',
    };

    MockedDB.mockImplementation(() => {
      return {
        prepare: (sql: string) => {
          return {
            get: (key: number): { [key: string]: string } | undefined => {
              return {
                key: 'ba000001',
                value: JSON.stringify(expectedValue),
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

    expect(receivedValue).toEqual(expectedValue);
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