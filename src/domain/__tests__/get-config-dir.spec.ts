import { describe, expect, it } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import { getDataDir } from '../get-data-dir';
import mockedFs from '../../../__mocks__/fs';
import mockedOs from '../../../__mocks__/os';

jest.mock('fs');
jest.mock('os');

describe('getDataDir', () => {
  it.concurrent('should create a directory if not existed', async () => {
    const workDir = os.tmpdir();
    const dataDir = await getDataDir(path.join(workDir, 'something'));
    expect(mockedFs.promises.mkdir).toBeCalledWith(`${workDir}/something`, {"recursive": true});
    expect(dataDir).toEqual(`${workDir}/something`);
  });
  it.concurrent('should create a directory at the (os:home) directory', async () => {
    const dataDir = await getDataDir();
    const homeDir = mockedOs.homedir();
    expect(mockedFs.promises.mkdir).toBeCalledWith(`${homeDir}/.abr-geocoder`, {"recursive": true});
    expect(dataDir).toEqual(`${homeDir}/.abr-geocoder`);
  });
});
