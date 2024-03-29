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
import CLIInfinityProgress from 'cli-infinity-progress';
import StreamZip from 'node-stream-zip';
import fs from 'node:fs';
import path from 'node:path';
import StringHash from 'string-hash';
import { IStreamReady } from './istream-ready';
import { StreamReady } from './stream-ready';
import { DatasetRow } from './dataset/dataset-row';

export const findTargetFilesInZipFiles = async ({
  srcDir,
  dstDir,
  targetExtention,
  fileLoadingProgress,
  datasetHistory,
}: {
  srcDir: string;
  dstDir: string;
  targetExtention: string;
  fileLoadingProgress?: CLIInfinityProgress;
  datasetHistory: Map<string, DatasetRow>;
}): Promise<IStreamReady[]> => {
  const results: IStreamReady[] = [];
  for await (const d of await fs.promises.opendir(srcDir)) {
    const filePath = path.join(srcDir, d.name);
    fileLoadingProgress?.setFooter(filePath.replace(dstDir + '/', ''));

    if (d.isDirectory()) {
      (
        await findTargetFilesInZipFiles({
          srcDir: filePath,
          dstDir,
          targetExtention,
          fileLoadingProgress,
          datasetHistory,
        })
      ).forEach(result => {
        results.push(result);
      });
      continue;
    }
    if (!d.isFile() || !d.name.endsWith('.zip')) {
      continue;
    }
    const zip = new StreamZip.async({
      file: filePath,
    });
    const entries = await zip.entries();
    for await (const zipEntry of Object.values(entries)) {
      if (zipEntry.name.endsWith(targetExtention)) {
        const prev = datasetHistory.get(zipEntry.name);
        const isSameFile = prev?.equalExceptType({
          key: zipEntry.name,
          contentLength: zipEntry.size,
          crc32: zipEntry.crc,
          lastModified: zipEntry.time,
        });
        if (isSameFile) {
          continue;
        }

        results.push(
          new StreamReady({
            zipEntry,
            streamFactory: async () => {
              return zip.stream(zipEntry);
            },
          })
        );
        continue;
      }
      if (!zipEntry.name.endsWith('.zip')) {
        continue;
      }

      const tmpDirName = StringHash(
        `${d.name.replace(/[^a-z0-9_]/gi, '')}_${zipEntry.name.replace(
          /[^a-z0-9_]/gi,
          ''
        )}`
      );
      const dstDirPath = `${dstDir}/${tmpDirName}`;
      await fs.promises.mkdir(dstDirPath);
      const dst = `${dstDirPath}/${zipEntry.name}`;
      await zip.extract(zipEntry, dst);
      (
        await findTargetFilesInZipFiles({
          srcDir: dstDirPath,
          dstDir: dstDir,
          targetExtention,
          fileLoadingProgress,
          datasetHistory,
        })
      ).forEach(result => {
        results.push(result);
      });
    }
  }

  return results;
};
