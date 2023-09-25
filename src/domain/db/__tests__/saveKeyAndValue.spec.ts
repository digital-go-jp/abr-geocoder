import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { default as BetterSqlite3, default as Database } from 'better-sqlite3';
import {DatasetMetadata} from '../..';
import {saveKeyAndValue} from '../saveKeyAndValue';
import stringHash from "string-hash";

jest.mock<BetterSqlite3.Database>('better-sqlite3');
jest.mock('string-hash')

const MockedDB = Database as unknown as jest.Mock;

const mockRunMethod = jest.fn();

const mockedStringHash = stringHash as jest.MockedFunction<(args0: string) => number>;
mockedStringHash.mockReturnValue(123456);

MockedDB.mockImplementation(() => {
  return {
    prepare: (sql: string) => {
      return {
        run: mockRunMethod,
      };
    },
  };
});

describe("saveKeyAndValue()", () => {
  const mockedDB = new Database('<no sql file>');

  beforeEach(() => {
    mockRunMethod.mockClear();
    MockedDB.mockClear();
    mockedStringHash.mockClear();
  });

  it("should encode value as JSON", () => {
    const value = new DatasetMetadata({
      lastModified: 'Thu, 29 Jun 2023 20:03:24 GMT',
      etag: '"85a3b4aefbe07aad6ef6da7a17d87dd4-60"',
      contentLength: 503120257,
      fileUrl: 'https://catalog.registries.digital.go.jp/rsc/address/address_all.csv.zip',
    });

    saveKeyAndValue({
      db: mockedDB,
      key: 'ba000001',
      value
    });
    expect(mockedStringHash).toBeCalledWith('ba000001');
    expect(mockRunMethod).toBeCalled();
    const receivedValue = mockRunMethod.mock.calls[0][0]];
    const valueProp = JSON.parse((receivedValue as any).value);

    expect(valueProp).toEqual(value.toJSON());
  });
});