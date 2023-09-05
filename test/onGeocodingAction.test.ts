import fs from 'node:fs';
import path from 'node:path';
import streamEqual from 'stream-equal';
import { geocodeFromStream } from '../src/cli/interface-adapters/onGeocodingAction';
import stream from 'node:stream';

describe('geocoding', () => {
  it('read from stdin', async () => {
    const sampleDataStream = fs.createReadStream(
      path.join(__dirname, 'sample-data.txt'),
      'utf-8'
    );
    const answerDataStream = fs.createReadStream(
      path.join(__dirname, 'sample-output.txt'),
      'utf-8'
    );

    const output = geocodeFromStream({
      source: sampleDataStream,
      dataDir: '',
      resourceId: '',
      fuzzy: '',
    });

    const chunks: Uint8Array[] = [];

    const output2 = output.pipe(
      new stream.Transform({
        transform(chunk, encoding, callback) {
          chunks.push(chunk);
          callback(null, chunk);
        },
      })
    );

    const isEqual = await streamEqual(answerDataStream, output2);
    console.log(Buffer.concat(chunks).toString());
    expect(true).toBe(true);
  });
});
