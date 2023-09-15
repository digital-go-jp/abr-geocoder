import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDataDir } from '../getDataDir';

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
