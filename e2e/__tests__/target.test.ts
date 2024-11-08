/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
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
import { describe, test } from '@jest/globals';
import {
  OutputFormat,
  SearchTarget
} from '../../src/index';
import { testRunner } from './common';

describe('target select cases', () => {
  test('--target=all', async () => {
    await testRunner({
      inputFile: `${__dirname}/../test-data/target-option-test/input.txt`,
      expectFile: `${__dirname}/../test-data/target-option-test/all-expects.json`,
      geocode: {
        outputFormat: OutputFormat.JSON,
        searchTarget: SearchTarget.ALL,
      }
    });
  });
  test('--target=residential', async () => {
    await testRunner({
      inputFile: `${__dirname}/../test-data/target-option-test/input.txt`,
      expectFile: `${__dirname}/../test-data/target-option-test/residential-expects.json`,
      geocode: {
        outputFormat: OutputFormat.JSON,
        searchTarget: SearchTarget.RESIDENTIAL,
      }
    });
  });
  test('--target=parcel', async () => {
    await testRunner({
      inputFile: `${__dirname}/../test-data/target-option-test/input.txt`,
      expectFile: `${__dirname}/../test-data/target-option-test/parcel-expects.json`,
      geocode: {
        outputFormat: OutputFormat.JSON,
        searchTarget: SearchTarget.PARCEL,
      }
    });
  });
  
});
