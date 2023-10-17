import { OutputFormat } from '@domain/output-format';
import { describe, expect, it, jest } from '@jest/globals';
import { GEOCODE_RESULT, geocode } from '../geocode';

jest.dontMock('../geocode');
jest.mock('fs');
jest.mock('@domain/geocode/get-read-stream-from-source');
jest.mock('@interface-adapter/setup-container');
jest.mock('../stream-geocoder');

describe('geocoding', () => {
  it.concurrent('should return ON_GECODING_RESULT.SUCCESS', async () => {
    const result = await geocode({
      ckanId: 'ba00001',
      dataDir: './somewhere',
      destination: './output.txt',
      format: OutputFormat.CSV,
      source: './input.txt',
    });

    expect(result).toBe(GEOCODE_RESULT.SUCCESS);
  });
})