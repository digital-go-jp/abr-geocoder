// reflect-metadata is necessary for DI
import { describe, expect, it, jest } from '@jest/globals';
import 'reflect-metadata';
import { ON_UPDATE_CHECK_RESULT, onUpdateCheck } from '../index';

jest.mock('../../../interface-adapter/setupContainer');
jest.mock('../../../usecase/downloader/CkanDownloader');

describe('onUpdateCheck', () => {
  it.concurrent('should return "NEW_DATASET_IS_AVAILABLE" if update is available', async () => {

    const result = await onUpdateCheck({
      ckanId: 'first access',
      dataDir: 'somewhere',
    });

    expect(result).toBe(ON_UPDATE_CHECK_RESULT.NEW_DATASET_IS_AVAILABLE);
  });
  it.concurrent('should return "NO_UPDATE_IS_AVAILABLE" if no update', async () => {

    const result = await onUpdateCheck({
      ckanId: 'second access',
      dataDir: 'somewhere',
    });

    expect(result).toBe(ON_UPDATE_CHECK_RESULT.NO_UPDATE_IS_AVAILABLE);
  });
})