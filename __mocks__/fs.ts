import { jest } from '@jest/globals';
import { Writable } from 'node:stream';
const original = jest.requireActual<typeof import('fs')>('fs');

export const promises = {
  mkdir: jest.fn(async () => {
    return Promise.resolve();
  }),
  mkdtemp: jest.fn(async () => {
    return Promise.resolve();
  }),
  rm: jest.fn(async () => {
    return Promise.resolve();
  }),
  readFile: jest.fn(async () => {
    return Promise.resolve();
  }),
};

export const createWriteStream = jest.fn(() => {
  return new Writable({
    write(chunk, encoding, callback) {
      callback();
    },
  });
});

// true にしたいテストと、false にしたいテストがあるので、
// mockReturnValueOnce で直接書き換える
export const existsSync = jest.fn();

export default {
  ...original,
  createWriteStream,
  existsSync,
  promises,
}
