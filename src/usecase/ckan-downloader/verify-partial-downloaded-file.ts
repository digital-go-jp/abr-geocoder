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
import { getRequest } from '@domain/http/get-request';
import { StatusCodes } from 'http-status-codes';
import fs from 'node:fs';

export const verifyPartialDownloadedFile = async ({
  metadata,
  targetFile,
  userAgent,
}: {
  metadata: DatasetMetadata;
  targetFile: string;
  userAgent: string;
}): Promise<boolean> => {
  if (!fs.existsSync(targetFile)) {
    return false;
  }

  const stat = await fs.promises.stat(targetFile);

  // 2kbytes ないと判定できないので false
  if (stat.size < 2048) {
    return false;
  }

  // ファイルの末尾1024バイトを比較する
  const startAt = stat.size - 1024;

  const response = await getRequest({
    url: metadata.fileUrl,
    userAgent,
    headers: {
      Range: `bytes=${startAt}-${stat.size - 1}`,
    },
  });

  const recvLast1k = Buffer.from(await response.body.arrayBuffer());
  response.body.destroy();

  if (response.statusCode !== StatusCodes.PARTIAL_CONTENT) {
    return false;
  }

  const contentLength = parseInt(
    (response.headers['content-range'] as string).split('/')[1]
  );
  if (contentLength < stat.size) {
    return false;
  }

  const fileLast1k = Buffer.alloc(1024);
  const fd = await fs.promises.open(targetFile, 'r');
  await fd.read(fileLast1k, 0, 1024, startAt);
  fd.close();

  return Buffer.compare(fileLast1k, recvLast1k) === 0;
};
