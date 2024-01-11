/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { jest } from '@jest/globals';
import { DI_TOKEN } from '../tokens';
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
          return undefined;

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

        case DI_TOKEN.NORMALIZE_FORMATTER:
          return new PassThrough();

        case DI_TOKEN.MULTI_PROGRESS_BAR:
          return undefined;

        case DI_TOKEN.INFINITY_PROGRESS_BAR:
          return undefined;

        case DI_TOKEN.PROGRESS_BAR:
          return undefined;

        default:
          throw(`Not implemented : ${target}`)
      }
    },
  };
});
