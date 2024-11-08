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
import { WorkerPoolTaskInfo } from "@domain/services/thread/worker-thread-pool-task-info";
import { GeocodeTransform } from '@usecases/geocode/worker/geocode-worker';
import { EventEmitter, Readable, Writable } from "node:stream";
import { AbrGeocoderInput } from "./models/abrg-input-data";
import { Query, QueryJson } from "./models/query";

export class FakeWorkerThreadPool extends EventEmitter implements IWorkerThreadPool<AbrGeocoderInput, QueryJson> {

  private readonly taskToNodeMap: Map<number, WorkerPoolTaskInfo<AbrGeocoderInput, QueryJson>> = new Map();
  
  private readonly reader = new Readable({
    objectMode: true,
    read() {},
  });
  
  constructor(geocodeTransform: GeocodeTransform) {
    super();

    // Promiseの resolveに結果を渡す
    const dst = new Writable({
      objectMode: true,
      write: (query: Query, _, callback) => {
        callback();
        const taskId = query.input.taskId;
        if (!this.taskToNodeMap.has(taskId)) {
          throw `Can not find the taskId: ${taskId}`;
        }

        // taskIdに紐づいて保存してある resolver に結果を渡す
        const taskNode = this.taskToNodeMap.get(taskId)!;
        this.taskToNodeMap.delete(taskId);
        taskNode.done(null, query.toJSON());
      },
    });

    this.reader
      .pipe(geocodeTransform)
      .pipe(dst);
  }

  run(input: AbrGeocoderInput): Promise<QueryJson> {

    let taskId = Math.floor(performance.now() + Math.random() * performance.now());
    while (this.taskToNodeMap.has(taskId)) {
      taskId = Math.floor(performance.now() + Math.random() * performance.now());
    }

    // resolver, rejector をキープする
    const taskNode = new WorkerPoolTaskInfo<AbrGeocoderInput, QueryJson>(input);
    this.taskToNodeMap.set(taskId, taskNode);

    return new Promise((
      resolve: (result: QueryJson) => void,
      reject: (err: Error) => void,
    ) => {
      taskNode.setResolver(resolve);
      taskNode.setRejector(reject);
      this.reader.push({
        data: input,
        taskId,
      });
    });
  }
  close(): void {
    this.reader.push(null);
  }
}
