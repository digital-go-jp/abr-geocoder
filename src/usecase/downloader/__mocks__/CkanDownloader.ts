import { jest } from '@jest/globals';
import { CkanDownloaderParams } from '../CkanDownloader';

export const CkanDownloader = function (params: CkanDownloaderParams) {
  const original = jest.requireActual<typeof import('../CkanDownloader')>('../CkanDownloader');
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
