import { jest } from '@jest/globals';
import { DownloadDbController as DbCtrl } from '../download-db-controller';
import { PrefLgCode } from '@domain/types/pref-lg-code';
import { PrefInfo } from '@domain/types/geocode/pref-info';

// DownloadDbController の型を取得
type DownloadDbControllerType = jest.MockedClass<typeof DbCtrl>;

const dummyPrefList: PrefInfo[] = [
  {
    lg_code: PrefLgCode.KAGAWA,
    pref_key: 5859200,
    pref: '神奈川',
    rep_lat: '35.44771',
    rep_lon: '139.642536',
  },
];

export const DownloadDbController = jest.fn()
  .mockImplementation((params: any) => {
    return {
      connectParams: params,
      openCommonDb: jest.fn().mockReturnValue({
        getPrefList: jest.fn<() => Promise<PrefInfo[]>>().mockResolvedValue(dummyPrefList),
      }),
      openDatasetDb: jest.fn(),
      openRsdtBlkDb: jest.fn(),
      openRsdtDspDb: jest.fn(),
      openParcelDb: jest.fn(),
    };
  }) as DownloadDbControllerType;
