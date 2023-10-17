import { FromStep3Type } from '@domain/from-step3-type';
import { Query } from '@domain/query';
import { describe, expect, it, jest } from '@jest/globals';
import Stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GeocodingStep3Final } from '../step3final-transform';

describe('GeocodingStep3Final', () => {
  it.concurrent('should involve the callback of the chunk', async () => {
    
    const fromStep3: FromStep3Type = {
      query: Query.create('somewhere'),
      callback: jest.fn(),
    };
    await pipeline(
      Stream.Readable.from(
        [
          fromStep3,
        ],
        {
          objectMode: true,
        }
      ),
      new GeocodingStep3Final(),
    );

    expect(fromStep3.callback).toBeCalledWith(null, fromStep3.query);
  });
});
