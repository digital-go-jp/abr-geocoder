import { jest } from '@jest/globals';
import { DI_TOKEN } from '../tokens';
import { Logger } from 'winston';
import { PassThrough } from 'node:stream';
import { default as Database } from 'better-sqlite3';

// __mocks__/winston
jest.mock('winston');

// __mocks__/better-sqlite3
jest.mock('better-sqlite3');

export const setupContainer = jest.fn().mockImplementation(() => {
  return {
    resolve: (target: DI_TOKEN) => {
      switch (target) {
        case DI_TOKEN.LOGGER:
          return new Logger();

        case DI_TOKEN.DATABASE:
          return new Database('dummy');

        case DI_TOKEN.DATASET_URL:
          return 'dataset_url';

        case DI_TOKEN.USER_AGENT:
          return 'user_agent';

        case DI_TOKEN.CSV_FORMATTER:
          return new PassThrough();

        case DI_TOKEN.JSON_FORMATTER:
          return new PassThrough();

        case DI_TOKEN.GEOJSON_FORMATTER:
          return new PassThrough();

        case DI_TOKEN.NDGEOJSON_FORMATTER:
          return new PassThrough();

        case DI_TOKEN.NDJSON_FORMATTER:
          return new PassThrough();

        default:
          return jest.fn();
      }
    },
  };
});
