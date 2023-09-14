import { describe, expect, it } from '@jest/globals';
import { CsvTransform } from '../CsvTransform';
import { Stream } from 'node:stream';
import { dummyData } from './dummyData';
import fs from 'node:fs';
import path from 'node:path';

describe('CsvTransform', () => {
  it('should output rows with CSV format()', async () => {
    const transform = CsvTransform.create(CsvTransform.DEFAULT_COLUMNS);

    const expectCsv = await fs.promises.readFile(
      path.normalize(path.join(__dirname, './expectCsvOutput.csv')),
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
    expect(result.trim()).toEqual(expectCsv.trim())
  });
});
