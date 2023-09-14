import { describe, expect, it } from '@jest/globals';
import { JsonTransform } from '../JsonTransform';
import { Stream } from 'node:stream';
import { dummyData } from './dummyData';
import fs from 'node:fs';
import path from 'node:path';

describe('JsonTransform', () => {
  it('should output rows with expected JSON format()', async () => {
    const transform = JsonTransform.create();

    const expectJson = await fs.promises.readFile(
      path.normalize(path.join(__dirname, './expectJsonOutput.json')),
      'utf-8',
    )

    const buffer: string[] = [];
    const writable = new Stream.Writable({
      objectMode: true,
      write(chunk, encoding, callback) {
        buffer.push(chunk.toString());
        callback();
      },
    })
    const readStream = Stream.Readable.from(dummyData);

    await Stream.promises.pipeline(
      readStream,
      transform,
      writable,
    )
    
    const result = buffer.join('');
    expect(result.trim()).toEqual(expectJson.trim())
  });
});
