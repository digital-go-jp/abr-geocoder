import { jest } from '@jest/globals';

export const Downloader = jest.fn(() => {
  return {
    download: jest.fn(),
  };
});

module.exports = {
  Downloader,
};
