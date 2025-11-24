import { describe, expect, test, jest } from '@jest/globals';
import { Readable } from 'node:stream';
import { AbrGeocoder } from '../abr-geocoder';
import { AbrGeocoderStream } from '../abr-geocoder-stream';
import { MatchLevel } from '@domain/types/geocode/match-level';

describe('AbrGeocoderStream', () => {
  test('should handle rejection from geocoder', (done) => {
    const mockGeocoder = {
      geocode: jest.fn().mockRejectedValue(new Error('Test Error')),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as AbrGeocoder;

    const stream = new AbrGeocoderStream({
      geocoder: mockGeocoder,
      fuzzy: '?',
    });

    const input = ['東京都千代田区千代田1-1'];
    const readable = Readable.from(input);

    readable.pipe(stream);

    let receivedCount = 0;
    stream.on('data', (data) => {
      receivedCount++;
      if (data.match_level.num === MatchLevel.ERROR.num) {
        done();
      }
    });

    stream.on('end', () => {
      if (receivedCount === 0) {
        done(new Error('Stream ended without receiving data'));
      }
    });

    stream.on('error', (err) => {
      done(err);
    });
  });
});
