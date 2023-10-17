import { jest } from '@jest/globals';
import { CkanDownloaderParams } from '../ckan-downloader';

export const CkanDownloader = function (params: CkanDownloaderParams) {
  const original = jest.requireActual<typeof import('../ckan-downloader')>('../ckan-downloader');
  return {
    updateCheck: jest.fn().mockImplementation(() => {
      if (params.ckanId === 'first access') {
        return true; // アップデートあり
      } else {
        return false; // アップデートなし
      }
    }),
  };
};
