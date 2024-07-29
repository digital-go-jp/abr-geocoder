import { Worker } from 'node:worker_threads';

export function createWorkerThread<T>(filename: string, workerData: T, otherOptions?: {
  affinity: number;
}) {
  return new Worker(filename, {
    ...otherOptions,
    workerData,
  });
}