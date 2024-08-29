import { jest } from '@jest/globals';

export const GeocodeDbController = jest.fn().mockImplementation(() => {
  return {
    openCommonDb: jest.fn(),
    openRsdtBlkDb: jest.fn(),
    openRsdtDspDb: jest.fn(),
    openParcelDb: jest.fn(),
  };
});
