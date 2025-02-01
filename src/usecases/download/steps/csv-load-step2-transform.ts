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

import { DatasetFile } from '@domain/models/dataset-file';
import { CsvLoadQuery, DownloadProcessStatus } from '@domain/models/download-process-query';
import { SemaphoreManager } from '@domain/services/thread/semaphore-manager';
import { ThreadJob } from '@domain/services/thread/thread-task';
import { DownloadDbController } from '@drivers/database/download-db-controller';
import fs from 'node:fs';
import { Duplex, TransformCallback } from 'node:stream';
import { loadCsvToDatabase } from './load-csv-to-database';

export type CsvLoadStep2TransformParams = {
  databaseCtrl: DownloadDbController;
  semaphore: SemaphoreManager;
  keepFiles: boolean;  
};

export class CsvLoadStep2Transform extends Duplex {

  constructor(private readonly params: Required<CsvLoadStep2TransformParams>) {
    super({
      objectMode: true,
      allowHalfOpen: true,
      read() {},
    });
  }

  getSemaphoreIdx(datasetFile: DatasetFile): number {
    if (datasetFile.type === 'pref' ||
      datasetFile.type === 'pref_pos' ||
      datasetFile.type === 'city' ||
      datasetFile.type === 'city_pos' ||
      datasetFile.type === 'town' ||
      datasetFile.type === 'town_pos') {
      return 0;
    }
  
    return (parseInt(datasetFile.lgCode) % (this.params.semaphore.size - 1)) + 1;
  };
  
  async _write(
    job: ThreadJob<CsvLoadQuery>,
    _: BufferEncoding,
    callback: TransformCallback,
  ) {

    const queue = job.data.files;
    while (queue.length > 0) {
      const fileInfo = queue.shift()!;

      // LGCodeに基づいてセマフォをロックする
      const lockIdx = this.getSemaphoreIdx(fileInfo.datasetFile);
      await this.params.semaphore.enterAwait(lockIdx);

      // DBに取り込む
      try {
        await loadCsvToDatabase({
          datasetFile: fileInfo.datasetFile,
          databaseCtrl: this.params.databaseCtrl,
        });
      } catch (e: unknown) {
        if (e &&
          typeof e === 'object' &&
          ('code' in e) &&
          e.code === 'SQLITE_BUSY'
        ) {
          this.params.semaphore.leave(lockIdx);

          // キューの末尾に追加（先に他のタスクを処理する）
          setTimeout(() => {
            queue.push(fileInfo);
          }, 10 + Math.random() * 200);
          continue;
        }

        // セマフォのロックを解除する
        this.params.semaphore.leave(lockIdx);
        console.error(e);
        callback(e as Error);
        return;
      }

      // セマフォのロックを解除する
      this.params.semaphore.leave(lockIdx);
    }

    // 展開したcsvファイルを消す
    await Promise.all((job as ThreadJob<CsvLoadQuery>).data.files.map(file => {
      return fs.promises.unlink(file.csvFile.path);
    }));

    // ダウンロードしたデータセットファイルを消す
    if (!this.params.keepFiles) {
      await fs.promises.unlink(job.data.zipFilePath);
    }

    // 次のステップに情報を渡す
    this.push({
      taskId: job.taskId,
      kind: 'task',
      data: {
        dataset: job.data.dataset,
        status: DownloadProcessStatus.SUCCESS,
        urlCache: job.data.urlCache,
      },
    });
    callback();
  }
}
