import { jest } from '@jest/globals';

export const Logger = jest.fn().mockImplementation(() => {
  return {
    info: jest.fn(),
  };
});
