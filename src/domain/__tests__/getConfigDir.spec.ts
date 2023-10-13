import { describe, expect, it } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import { getDataDir } from '../getDataDir';

jest.unmock('fs');
const fs = require('fs');

describe('getDataDir', () => {
  it.concurrent('should create a directory if not existed', async () => {
    const workDir = os.tmpdir();
    const dataDir = await getDataDir(path.join(workDir, 'something'));
    expect(fs.existsSync(dataDir)).toBe(true);
  });
  it.concurrent('should create a directory at the (os:home) directory', async () => {
    const dataDir = await getDataDir();
    expect(fs.existsSync(dataDir)).toBe(true);
  });
});
