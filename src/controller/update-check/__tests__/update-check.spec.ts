// reflect-metadata is necessary for DI
import { describe, expect, it, jest } from '@jest/globals';
import 'reflect-metadata';
import { updateCheck } from '../update-check';
import { UPDATE_CHECK_RESULT } from '../update-check-result';

jest.mock('@interface-adapter/setup-container');
jest.mock('@usecase/ckan-downloader/ckan-downloader');

describe('onUpdateCheck', () => {
  it.concurrent('should return "NEW_DATASET_IS_AVAILABLE" if update is available', async () => {

    const result = await updateCheck({
      ckanId: 'first access',
      dataDir: 'somewhere',
    });

    expect(result).toBe(UPDATE_CHECK_RESULT.NEW_DATASET_IS_AVAILABLE);
  });
  it.concurrent('should return "NO_UPDATE_IS_AVAILABLE" if no update', async () => {

    const result = await updateCheck({
      ckanId: 'second access',
      dataDir: 'somewhere',
    });

    expect(result).toBe(UPDATE_CHECK_RESULT.NO_UPDATE_IS_AVAILABLE);
  });
})