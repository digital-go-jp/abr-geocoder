import { EnvProvider } from '@domain/models/env-provider';
import { describe, expect, jest, test } from '@jest/globals';
import { DownloadDiContainer } from '@usecases/download/models/download-di-container';
import { Downloader } from '../download-process';

// @@interface/database/__mocks__/geocode-db-controller
jest.mock('@interface/database/geocode-db-controller');

// @usecases/geocode/services/__mocks__/load-geocoder-common-data
jest.mock('@usecases/geocode/services/load-geocoder-common-data');

// @usecases/download/transformations/__mocks__/download-transform
jest.mock('@usecases/download/transformations/download-transform');

// @usecases/download/transformations/__mocks__/csv-parse-transform
jest.mock('@usecases/download/transformations/csv-parse-transform.ts');

// @interface/__mocks__/http-request-adapter
jest.mock('@interface/http-request-adapter');

jest.spyOn(EnvProvider.prototype, 'availableParallelism').mockReturnValue(5);

describe('Downloader', () => {

  test('should be created an instance correctly', async () => {
    jest
      .spyOn(DownloadDiContainer.prototype, 'getPackageListUrl')
      .mockReturnValue('http://localhost/ok_url');

    const instance = new Downloader({
      database: {
        type: 'sqlite3',
        dataDir: 'dataDir_somewhere',
        schemaDir: 'schemaDir_somewhere',
      },
      cacheDir: 'cacheDir_somewhere',
      downloadDir: 'downloadDir_somewhere',
    });

    expect(instance).not.toBeNull();
    const progressSpy = jest.fn();

    await instance.download({
      lgCodes: ['131016'],
      progress: progressSpy,
      concurrentDownloads: 7,
    });
  });
});
