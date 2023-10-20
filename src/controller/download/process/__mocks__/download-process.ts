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
import { DatasetMetadata } from '@domain/dataset-metadata';
import { jest } from '@jest/globals';
import { DependencyContainer } from 'tsyringe';

export const downloadProcess = jest.fn(async (params: {
  ckanId: string;
  dstDir: string;
  container: DependencyContainer;
}): Promise<{
  metadata: DatasetMetadata;
  downloadFilePath: string | null;
}> => {
  return Promise.resolve({
    downloadFilePath: `${params.dstDir}/download`,

    // curl -I https://catalog.registries.digital.go.jp/rsc/address/address_all.csv.zip
    metadata: new DatasetMetadata({
      lastModified: 'Thu, 29 Jun 2023 20:03:24 GMT',
      contentLength: 503120257,
      etag: '"85a3b4aefbe07aad6ef6da7a17d87dd4-60"',
      fileUrl: 'https://catalog.registries.digital.go.jp/rsc/address/address_all.csv.zip',
    })
  })
});