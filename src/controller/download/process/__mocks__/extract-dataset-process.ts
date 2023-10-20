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

import { DatasetRow } from "@domain/dataset/dataset-row";
import { IStreamReady } from "@domain/istream-ready";
import { jest } from '@jest/globals';
import stream from 'node:stream';
import { DependencyContainer } from "tsyringe";

export const extractDatasetProcess = jest.fn(async (params: {
  srcFile: string;
  dstDir: string;
  container: DependencyContainer;
  datasetHistory: Map<string, DatasetRow>;
}) => {
  return Promise.resolve<IStreamReady[]>([
    {
      name: 'mt_city_all.csv',
      contentLength: 237764,
      crc32: 814415613,
      lastModified: 1674556098000,
      async getStream(): Promise<NodeJS.ReadableStream> {
        return stream.Readable.from([]);
      },
    },
    {
      name: 'mt_pref_all.csv',
      contentLength: 2758,
      crc32: 956018549,
      lastModified: 1641570854000,
      async getStream(): Promise<NodeJS.ReadableStream> {
        return stream.Readable.from([]);
      },
    },
    {
      name: 'mt_rsdtdsp_blk_pref01.csv',
      contentLength: 7434057,
      crc32: 1012054291,
      lastModified: 1674556144000,
      async getStream(): Promise<NodeJS.ReadableStream> {
        return stream.Readable.from([]);
      },
    },
    {
      name: 'mt_rsdtdsp_rsdt_pref01.csv',
      contentLength: 174393385,
      crc32: 3685780372,
      lastModified: 1674556208000,
      async getStream(): Promise<NodeJS.ReadableStream> {
        return stream.Readable.from([]);
      },
    },
    {
      name: 'mt_town_all.csv',
      contentLength: 152740134,
      crc32: 3996387812,
      lastModified: 1674556118000,
      async getStream(): Promise<NodeJS.ReadableStream> {
        return stream.Readable.from([]);
      },
    },
    {
      name: 'mt_rsdtdsp_blk_pos_pref01.csv',
      contentLength: 15992158,
      crc32: 3050934268,
      lastModified: 1674556152000,
      async getStream(): Promise<NodeJS.ReadableStream> {
        return stream.Readable.from([]);
      },
    },
    {
      name: 'mt_rsdtdsp_rsdt_pos_pref01.csv',
      contentLength: 229730854,
      crc32: 3025020626,
      lastModified: 1674556268000,
      async getStream(): Promise<NodeJS.ReadableStream> {
        return stream.Readable.from([]);
      },
    },
    {
      name: 'mt_town_pos_pref01.csv',
      contentLength: 2229768,
      crc32: 4236985285,
      lastModified: 1674556138000,
      async getStream(): Promise<NodeJS.ReadableStream> {
        return stream.Readable.from([]);
      },
    }
  ]);

});