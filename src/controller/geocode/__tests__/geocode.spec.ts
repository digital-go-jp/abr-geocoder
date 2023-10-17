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
import { OutputFormat } from '@domain/output-format';
import { describe, expect, it, jest } from '@jest/globals';
import { GEOCODE_RESULT, geocode } from '../geocode';

jest.dontMock('../geocode');
jest.mock('fs');
jest.mock('@domain/geocode/get-read-stream-from-source');
jest.mock('@interface-adapter/setup-container');
jest.mock('../stream-geocoder');

describe('geocoding', () => {
  it.concurrent('should return ON_GECODING_RESULT.SUCCESS', async () => {
    const result = await geocode({
      ckanId: 'ba00001',
      dataDir: './somewhere',
      destination: './output.txt',
      format: OutputFormat.CSV,
      source: './input.txt',
    });

    expect(result).toBe(GEOCODE_RESULT.SUCCESS);
  });
})