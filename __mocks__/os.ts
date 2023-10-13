import { jest } from '@jest/globals';
const original = jest.requireActual<typeof import('os')>('os');

const tmpdir = jest.fn().mockReturnValue(__dirname);
const homeDir = jest.fn().mockReturnValue(__dirname);

export default {
  ...original,
  tmpdir,
  homeDir,
}
