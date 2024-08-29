import { jest } from '@jest/globals';
import { GeocodeDbController as DbCtrl } from '../geocode-db-controller';

// GeocodeDbController の型を取得
type GeocodeDbControllerType = jest.MockedClass<typeof DbCtrl>;
export const GeocodeDbController = jest.fn()
  .mockImplementation(() => {
    return {
      openCommonDb: jest.fn(),
      openRsdtBlkDb: jest.fn(),
      openRsdtDspDb: jest.fn(),
      openParcelDb: jest.fn(),
    };
  }) as GeocodeDbControllerType;
