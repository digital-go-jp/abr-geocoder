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

  it("should save value correctly", () => {

    saveKeyAndValue({
      db: mockedDB,
      key: 'ba000001',
      value: '1234',
    });
    expect(mockedStringHash).toBeCalledWith('ba000001');
    expect(mockRunMethod).toBeCalled();
    const receivedValue = mockRunMethod.mock.calls[0][0];
    expect(receivedValue).toEqual({"key": 123456, "value": "1234"});
  });
});