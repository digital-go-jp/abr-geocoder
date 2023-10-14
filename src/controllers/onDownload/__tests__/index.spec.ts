import { describe, expect, it, jest } from '@jest/globals';
import { default as BetterSqlite3 } from 'better-sqlite3';
import mockedFs from '../../../../__mocks__/fs';
import { ON_DOWNLOAD_RESULT, onDownload } from '../index';

jest.mock('fs');
jest.mock('node:fs');
jest.mock('winston');
jest.mock<BetterSqlite3.Database>('better-sqlite3');
jest.mock('../../../interface-adapter/setupContainer');
jest.mock('../../../usecase/downloader/CkanDownloader');
jest.mock('../../../domain/db/saveKeyAndValue')
jest.mock('../loadDatasetHistory');

jest.mock('../downloadProcess');
jest.mock('../loadDatasetProcess');
jest.mock('../extractDatasetProcess');

describe('onDownload', () => {
  it.concurrent('should return "UPDATED" if update is available', async () => {

    const existsSync = mockedFs.existsSync;
    existsSync.mockReturnValueOnce(true);

    const result = await onDownload({
      ckanId: 'first access',
      dataDir: 'somewhere',
    });

    expect(result).toBe(ON_DOWNLOAD_RESULT.SUCCESS);
    expect(existsSync).toBeCalledWith('somewhere/download/first access');
  });

})