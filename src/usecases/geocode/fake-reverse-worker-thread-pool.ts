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
import { IWorkerThreadPool } from "@domain/services/thread/iworker-thread-pool";
import { ThreadJob } from "@domain/services/thread/thread-task";
import { EventEmitter, Readable, Writable } from "node:stream";
import { ReverseGeocodeTransform } from './worker/reverse-geocode-worker';
import { ReverseGeocodeWorkerInput } from './worker/reverse-geocode-worker-init-data';

export class FakeReverseWorkerThreadPool extends EventEmitter implements IWorkerThreadPool<ReverseGeocodeWorkerInput, any> {

  private taskIdCounter = 0;
  private readonly reader = new Readable({
    objectMode: true,
    read() {},
  });

  constructor(private reverseTransform: ReverseGeocodeTransform) {
    super();

    // ReverseGeocodeTransformの出力を受け取る
    const dst = new Writable({
      objectMode: true,
      write: (chunk: any, _, callback) => {
        callback();
      },
    });

    this.reader
      .pipe(reverseTransform)
      .pipe(dst);
  }

  async run(data: ReverseGeocodeWorkerInput): Promise<any> {
    return new Promise((resolve, reject) => {
      const taskId = this.taskIdCounter++;

      // 結果を一度だけ受け取るリスナーを設定
      const resultHandler = (chunk: any) => {
        if (chunk.taskId === taskId) {
          this.reverseTransform.removeListener('data', resultHandler);
          resolve(chunk.results);
        }
      };

      const errorHandler = (error: Error) => {
        this.reverseTransform.removeListener('error', errorHandler);
        reject(error);
      };

      this.reverseTransform.on('data', resultHandler);
      this.reverseTransform.once('error', errorHandler);

      // ThreadJob形式でデータを送信
      const job: ThreadJob<ReverseGeocodeWorkerInput> = {
        kind: 'task',
        taskId,
        data,
      };

      this.reader.push(job);
    });
  }

  async close(): Promise<void> {
    this.reader.push(null);
    this.reader.destroy();
    this.reverseTransform.destroy();
  }

  isTerminating(): boolean {
    return false;
  }
}
