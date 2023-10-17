import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { default as BetterSqlite3, default as Database } from 'better-sqlite3';

jest.mock<BetterSqlite3.Database>('better-sqlite3');
jest.mock('@domain/http/head-request');

const MockedDB = Database as unknown as jest.Mock;
import { CkanDownloader } from '../ckan-downloader'; // adjust this import according to your project structure


describe('CkanDownloader', () => {
  let ckanDownloader: CkanDownloader;

  beforeEach(() => {
    ckanDownloader = new CkanDownloader({
      userAgent: 'testUserAgent',
      datasetUrl: 'testDatasetUrl',
      db: new Database('dummy'), // mock this according to your Database implementation
      ckanId: 'testCkanId',
      dstDir: 'testDstDir',
    });
  });

  it('getDatasetMetadata method should be defined', () => {
    expect(ckanDownloader.getDatasetMetadata).toBeDefined();
  });

  it('updateCheck method should be defined', () => {
    expect(ckanDownloader.updateCheck).toBeDefined();
  });
});
