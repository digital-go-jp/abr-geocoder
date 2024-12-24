import { jest } from '@jest/globals';
import { DownloadDbController as DbCtrl } from '../download-db-controller';

// DownloadDbController の型を取得
type DownloadDbControllerType = jest.MockedClass<typeof DbCtrl>;
export const DownloadDbController = jest.fn()
  .mockImplementation((params: any) => {
    return {
      connectParams: params,
      openCommonDb: jest.fn(),
      openRsdtBlkDb: jest.fn(),
      openRsdtDspDb: jest.fn(),
      openParcelDb: jest.fn(),
    };
  }) as DownloadDbControllerType;
