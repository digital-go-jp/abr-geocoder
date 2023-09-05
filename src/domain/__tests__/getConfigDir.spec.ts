import {getDataDir} from '../getDataDir';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

describe('getDataDir', () => {
  it('should create a directory if not existed', async () => {
    const workDir = os.tmpdir();
    const dataDir = await getDataDir(path.join(workDir, 'something'));
    expect(fs.existsSync(dataDir)).toBe(true);
  });
  it('should create a directory at the (os:home) directory', async () => {
    const dataDir = await getDataDir();
    expect(fs.existsSync(dataDir)).toBe(true);
  });
});
