import { describe, expect, it, jest } from '@jest/globals';
import fs from "node:fs";
import { AbrgError, AbrgErrorLevel, AbrgMessage } from "../../../domain";
import { SINGLE_DASH_ALTERNATIVE } from "../../../settings/constantValues";
import { getReadStreamFromSource } from '../../../usecase';

describe('getReadStreamFromSource', () => {
  it.concurrent('should return process.stdin if the command is involved by "abrg -"', async () => {
    const orgStdIn = process.stdin;
    jest.replaceProperty(orgStdIn, 'isTTY', false);
    Object.defineProperty(orgStdIn, 'isDummy', {
      value: true,
    });
    
    const mockStdIn = jest.spyOn(process, 'stdin', 'get').mockReturnValue(orgStdIn);
    const result = getReadStreamFromSource(SINGLE_DASH_ALTERNATIVE);
    expect((result as any).isDummy).toEqual(true);

    mockStdIn.mockRestore();
  });
  it.concurrent('should throw an error if the command is involved by "abrg -" and process.stdin.isTTY', async () => {
    const orgStdIn = process.stdin;
    jest.replaceProperty(orgStdIn, 'isTTY', true);
    Object.defineProperty(orgStdIn, 'isDummy', {
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
  });

  it.concurrent('should return fs.ReadStream if source is a valid file', async () => {
    const result = getReadStreamFromSource(__filename);
    expect(result).toBeInstanceOf(fs.ReadStream);
  });

  it.concurrent('should occur an error if source is invalid file path.', async () => {
    expect(() => {
      getReadStreamFromSource('somewhere');
    }).toThrow(new AbrgError({
      messageId: AbrgMessage.CANNOT_FIND_INPUT_FILE,
      level: AbrgErrorLevel.ERROR,
    }));
  });
})