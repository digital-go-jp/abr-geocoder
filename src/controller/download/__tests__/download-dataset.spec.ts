import { describe, expect, it, jest } from '@jest/globals';
import { default as BetterSqlite3 } from 'better-sqlite3';
import mockedFs from '@mock/fs';
import { downloadDataset, DOWNLOAD_DATASET_RESULT } from '../download-dataset';

jest.mock('fs');
jest.mock('node:fs');
jest.mock('winston');
jest.mock<BetterSqlite3.Database>('better-sqlite3');
jest.mock('@interface-adapter/setup-container');
jest.mock('@usecase/ckan-downloader');
jest.mock('@domain/key-store/get-value-with-key')
jest.mock('@domain/key-store/save-key-and-value')
jest.mock('@process/download-process');
jest.mock('@process/load-dataset-history');
jest.mock('@process/load-dataset-process');
jest.mock('@process/extract-dataset-process');

describe('downloadDataset', () => {
  it.concurrent('should return "UPDATED" if update is available', async () => {

    const existsSync = mockedFs.existsSync;
    existsSync.mockReturnValueOnce(true);

    const result = await downloadDataset({
      ckanId: 'first access',
      dataDir: 'somewhere',
    });

    expect(result).toBe(DOWNLOAD_DATASET_RESULT.SUCCESS);
    expect(existsSync).toBeCalledWith('somewhere/download/first access');
  });

})