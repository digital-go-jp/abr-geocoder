import { describe, expect, it, jest } from '@jest/globals';
import { AbrgError, AbrgErrorLevel, AbrgMessage } from "../../../domain";
import { SINGLE_DASH_ALTERNATIVE } from "../../../settings/constantValues";
import { getReadStreamFromSource } from '../../../usecase';
import mockedFs from '../../../../__mocks__/fs';
const fs = jest.requireActual('fs');

jest.dontMock('../getReadStreamFromSource');

describe('getReadStreamFromSource', () => {
  it('should return process.stdin if the command is involved by "abrg -"', () => {
    const orgStdIn = Object.create(process.stdin);
    Reflect.defineProperty(orgStdIn, 'isTTY', {
      value: false,
    });
    Reflect.defineProperty(orgStdIn, 'isDummy', {
      value: true,
    });
    
    const mockStdIn = jest.spyOn(process, 'stdin', 'get').mockReturnValue(orgStdIn);
    const result = getReadStreamFromSource(SINGLE_DASH_ALTERNATIVE);
    expect((result as any).isDummy).toEqual(true);

    mockStdIn.mockRestore();
    Reflect.deleteProperty(orgStdIn, 'isTTY');
  });
  it('should throw an error if the command is involved by "abrg -" and process.stdin.isTTY', () => {
    const orgStdIn = Object.create(process.stdin);
    Reflect.defineProperty(orgStdIn, 'isTTY', {
      value: true,
    });
    Reflect.defineProperty(orgStdIn, 'isDummy', {
      value: true,
    });
    
    const mockStdIn = jest.spyOn(process, 'stdin', 'get').mockReturnValue(orgStdIn);
    expect(() => {
      getReadStreamFromSource(SINGLE_DASH_ALTERNATIVE);
    }).toThrow(new AbrgError({
      messageId: AbrgMessage.INPUT_SOURCE_FROM_STDIN_ERROR,
      level: AbrgErrorLevel.ERROR,
    }));

    mockStdIn.mockRestore();
    Reflect.deleteProperty(orgStdIn, 'isTTY');
  });

  it('should occur an error if source is invalid file path.', () => {
    expect(() => {
      getReadStreamFromSource('somewhere');
    }).toThrow(new AbrgError({
      messageId: AbrgMessage.CANNOT_FIND_INPUT_FILE,
      level: AbrgErrorLevel.ERROR,
    }));
  });

  it('should return fs.ReadStream if source is a valid file', () => {
    mockedFs.existsSync.mockReturnValue(true);
    const result = getReadStreamFromSource(__filename);
    expect(result).toBeInstanceOf((fs as typeof import('fs')).ReadStream);
  });
})