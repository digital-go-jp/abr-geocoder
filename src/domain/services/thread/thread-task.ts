export type ThreadChunk<T> = {
  taskId: number;
  data: T;
}

export type ThreadJob<T> = {
  kind: 'task';
} & ThreadChunk<T>;

export type ThreadSignal = {
  kind: 'signal';
  data: string;
} & Omit<ThreadChunk<string>, 'taskId'>;

export type ThreadMessage<T> = {
  kind: 'message';
} & Omit<ThreadChunk<T>, 'taskId'>;

export type ThreadJobResult<T> = {
  kind: 'result';
} & ThreadChunk<T>;