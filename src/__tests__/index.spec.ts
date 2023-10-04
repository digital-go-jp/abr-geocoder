// reflect-metadata is necessary for DI
import 'reflect-metadata';

import { jest, describe, expect, it, afterEach, beforeEach, beforeAll } from '@jest/globals';
import { packageJsonMeta, parsePackageJson, setupContainer } from '../interface-adapter';
import { onUpdateCheck, onDownload, onGeocoding } from '../controllers';
import { main } from '../index';


jest.mock('../domain', () => {
  const original: typeof import('../domain') = jest.requireActual('../domain');
  return {
    ...original,
    bubblingFindFile: jest.fn<(current: string, target: string)=>Promise<string | undefined>>().mockResolvedValue('somewhere'),
  }
});

jest.mock('../controllers', () => ({
  onUpdateCheck: jest.fn(),
  onGeocoding: jest.fn(),
  onDownload: jest.fn(),
}));
jest.mock('../interface-adapter', () => ({
  setupContainer: jest.fn(),
  parsePackageJson: jest.fn().mockReturnValue({
    version: '0.0.0',
    description: 'unit test'
  })
}));

describe('[cli]update-check', () => {

  it.concurrent("should run update-check command", async () => {
    await runCommand("update-check");

    expect(setupContainer).toBeCalledWith({
      dataDir: expect.any(String),
      ckanId: 'ba000001',
    });

    expect(onUpdateCheck).toBeCalledWith({
      container: undefined,
      ckanId: 'ba000001',
    })
  });
  it.concurrent("should receive specified options", async () => {
    await runCommand("update-check", '-r', 'something', '-d', 'somewhere');

    expect(setupContainer).toBeCalledWith({
      dataDir: 'somewhere',
      ckanId: 'something',
    });

    expect(onUpdateCheck).toBeCalledWith({
      container: undefined,
      ckanId: 'something',
    })
  });
  it.concurrent("should receive specified options with long option names", async () => {
    await runCommand("update-check", '--resource', 'something', '--dataDir', 'somewhere');

    expect(setupContainer).toBeCalledWith({
      dataDir: 'somewhere',
      ckanId: 'something',
    });

    expect(onUpdateCheck).toBeCalledWith({
      container: undefined,
      ckanId: 'something',
    })
  });
});
describe('[cli]download', () => {

  it.concurrent("should run download command", async () => {
    await runCommand("download");

    expect(setupContainer).toBeCalledWith({
      dataDir: expect.any(String),
      ckanId: 'ba000001',
    });

    expect(onDownload).toBeCalledWith({
      container: undefined,
      ckanId: 'ba000001',
      dataDir: expect.any(String),
    })
  });
  it.concurrent("should receive specified options", async () => {
    await runCommand("download", '-r', 'something', '-d', 'somewhere');

    expect(setupContainer).toBeCalledWith({
      dataDir: 'somewhere',
      ckanId: 'something',
    });

    expect(onDownload).toBeCalledWith({
      container: undefined,
      ckanId: 'something',
      dataDir: 'somewhere',
    })
  });
  it.concurrent("should receive specified options with long option names", async () => {
    await runCommand("download", '--resource', 'something', '--dataDir', 'somewhere');

    expect(setupContainer).toBeCalledWith({
      dataDir: 'somewhere',
      ckanId: 'something',
    });

    expect(onDownload).toBeCalledWith({
      container: undefined,
      ckanId: 'something',
      dataDir: 'somewhere',
    })
  });
});

// Programmatically set arguments and execute the CLI script
const runCommand = async (...args: string[]) => {
  const dummyArgv = [
    'node', // Not used but a value is reqired at the index in the array
    'abrg', // Not used but a value is reqired at the index in the array
    ...args
  ];

  // Require the yargs CLI script
  return await main(...dummyArgv);
}