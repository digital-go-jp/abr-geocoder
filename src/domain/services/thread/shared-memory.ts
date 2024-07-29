import { serialize, deserialize } from "node:v8";

export function toSharedMemory<T>(target: T): Uint8Array {
  const buffer = serialize(target);
  const sharedMemory = new SharedArrayBuffer(buffer.byteLength);
  const uint8Array = new Uint8Array(sharedMemory);
  uint8Array.set(buffer);
  return uint8Array;
};

export function fromSharedMemory<T>(memory: Uint8Array): T {
  const decodedBuffer = Buffer.from(memory);
  return deserialize(decodedBuffer) as T;
};