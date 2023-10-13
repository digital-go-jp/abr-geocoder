import { describe, expect, it, jest } from '@jest/globals';
import { default as BetterSqlite3 } from 'better-sqlite3';
import { existsSync as MockedExistsSync } from '../../../../__mocks__/fs';
import { ON_DOWNLOAD_RESULT, onDownload } from '../index';

jest.mock('fs');
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

    MockedExistsSync.mockImplementationOnce(() => {
      return true;
    });

    const result = await onDownload({
      ckanId: 'first access',
      dataDir: 'somewhere',
    });

    expect(result).toBe(ON_DOWNLOAD_RESULT.UPDATED);

  });

})