// reflect-metadata is necessary for DI
import { describe, expect, it, jest } from '@jest/globals';
import 'reflect-metadata';
const { ON_GECODING_RESULT, onGeocoding } = require('../index');
const { OutputFormat } = require('../../../domain');

jest.mock('fs');
jest.mock('../../../usecase/geocoder/getReadStreamFromSource');
jest.mock('../../../interface-adapter/setupContainer');
jest.mock('../StreamGeocoder');

describe('geocoding', () => {
  it.concurrent('should return ON_GECODING_RESULT.SUCCESS', async () => {
    const result = await onGeocoding({
      ckanId: 'ba00001',
      dataDir: './somewhere',
      destination: './output.txt',
      format: OutputFormat.CSV,
      source: './input.txt',
    });

    expect(result).toBe(ON_GECODING_RESULT.SUCCESS);
  });
})