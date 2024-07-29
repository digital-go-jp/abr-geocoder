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

import { CsvLoadQuery2, CsvLoadResult, DownloadProcessError, DownloadProcessStatus, isDownloadProcessError } from '@domain/models/download-process-query';
import { SemaphoreManager } from '@domain/services/thread/semaphore-manager';
import { ThreadJob } from '@domain/services/thread/thread-task';
import { DownloadDbController } from '@interface/database/download-db-controller';
import fs from 'node:fs';
import { Duplex, TransformCallback } from 'node:stream';
import { loadCsvToDatabase } from './load-csv-to-database';

export class CsvLoadStep2Transform extends Duplex {
  constructor(private readonly params: Required<{
    databaseCtrl: DownloadDbController;
    semaphore: SemaphoreManager;
  }>) {
    super({
      objectMode: true,
      allowHalfOpen: true,
      read() {},
    });
  }
  
  async _write(
    job: ThreadJob<CsvLoadQuery2 | DownloadProcessError>,
    _: BufferEncoding,
    callback: TransformCallback,
  ) {

    callback();
    
    // エラーになったQueryはスキップする
    if (isDownloadProcessError(job.data)) {
      this.push(job);
      return;
    }

    // DBに取り込む
    const tasks = job.data.files.map(fileInfo => {
      return loadCsvToDatabase({
        semaphore: this.params.semaphore,
        datasetFile: fileInfo.datasetFile,
        noUpdate: false, // (job as ThreadJob<CsvLoadQuery2>).data.csvFile.noUpdate,
        databaseCtrl: this.params.databaseCtrl,
      });
    });

    // await promise.all() で DBへの取り込み処理が完了するまで待つ
    const results = await Promise.all(tasks);
    const lgCodes = new Set<string>();
    results.forEach(lgCodeResults => {
      lgCodeResults?.forEach(lgCode => lgCodes.add(lgCode));
    });

    this.push({
      taskId: job.taskId,
      kind: 'task',
      data: {
        dataset: job.data.dataset,
        lgCodes,
        status: DownloadProcessStatus.SUCCESS,
      }
    } as ThreadJob<CsvLoadResult>);

    // 展開したcsvファイルを消す
    (job as ThreadJob<CsvLoadQuery2>).data.files.map(file => {
      return fs.promises.unlink(file.csvFile.path);
    });
  }
}