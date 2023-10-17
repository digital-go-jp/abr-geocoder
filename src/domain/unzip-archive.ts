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
import StreamZip from 'node-stream-zip';
import fs from 'node:fs';
import path from 'node:path';

export const unzipArchive = async ({
  srcZip,
  dstPath,
}: {
  srcZip: string;
  dstPath: string;
}): Promise<string> => {
  const outputPath = path.join(
    path.dirname(dstPath),
    path.basename(srcZip, '.zip')
  );
  if (fs.existsSync(outputPath)) {
    return outputPath;
  }

  const zip = new StreamZip.async({ file: srcZip });
  const entries = await zip.entries();
  const entriesAry = Object.values(entries);
  if (
    entriesAry.length === 1 &&
    entriesAry[0].name.toLowerCase().endsWith('.csv')
  ) {
    // we will use this zip file directly, so we don't need to decompress it.
    await zip.close();
    return srcZip;
  }

  const subExtracts: Promise<string>[] = [];
  zip.on('extract', (entry, filePath) => {
    if (!entry.name.toLowerCase().endsWith('.zip')) {
      return;
    }

    // If we found another zip files, decompress them
    subExtracts.push(
      unzipArchive({
        srcZip: filePath,
        dstPath,
      })
    );
  });
  await fs.promises.mkdir(outputPath, { recursive: true });
  await zip.extract(null, outputPath);
  await Promise.all(subExtracts);
  await zip.close();
  await fs.promises.rm(srcZip);

  return outputPath;
};
