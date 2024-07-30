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

import { DownloadProcessError, DownloadQuery2, DownloadResult, isDownloadProcessError } from '@domain/models/download-process-query';
import { ThreadJob } from '@domain/services/thread/thread-task';
import { ICsvFile } from '@domain/types/download/icsv-file';
import fs from 'node:fs';
import path from 'node:path';
import { Duplex } from 'node:stream';
import unzipper from 'unzipper';

export class DownloadStep2Transform extends Duplex {

  constructor(private readonly params: Required<{
    downloadDir: string;
  }>) {
    super({
      objectMode: true,
      allowHalfOpen: true,
      read() {},
    });
  }

  async _write(
    job: ThreadJob<DownloadQuery2 | DownloadProcessError>,
    _: BufferEncoding,
    callback: (error?: Error | null | undefined) => void,
  ) {
    callback();
    // エラーになったQueryはスキップする
    if (isDownloadProcessError(job.data)) {
      this.push(job as ThreadJob<DownloadProcessError>);
      return;
    }

    const csvFiles: ICsvFile[] = [];

    await (new Promise((resolve: (_?: void) => void) => {
      fs.createReadStream((job as ThreadJob<DownloadQuery2>).data.csvFilePath)
        .pipe(unzipper.Parse())
        .on('entry', async (entry) => {
          if (entry.type === 'Directory') {
            entry.autodrain();
            return;
          }

          const filename = path.basename(entry.path);
          const dstPath = path.join(this.params.downloadDir, filename);

          csvFiles.push({
            path: dstPath,
            name: filename,
            crc32: entry.vars.crc32,
            contentLength:(entry.vars as any).uncompressedSize,
            lastModified: entry.vars.lastModifiedTime,
            noUpdate: (job as ThreadJob<DownloadQuery2>).data.noUpdate,
          });
          entry.pipe(fs.createWriteStream(dstPath))
            .once('finish', resolve);
        })
    }))
    
    this.push({
      taskId: job.taskId,
      kind: 'task',
      data: {
        csvFiles,
        status: 'success',
        dataset: job.data.dataset,
      },
    } as ThreadJob<DownloadResult>);
  }

}