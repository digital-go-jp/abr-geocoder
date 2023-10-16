import { jest } from '@jest/globals';

export const parsePackageJson = jest.fn().mockReturnValue({
  version: '0.0.0',
  description: 'unit test'
});