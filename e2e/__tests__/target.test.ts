import { describe, test } from '@jest/globals';
import {
  OutputFormat,
  SearchTarget
} from '../../src/index';
import { testRunner } from './common';

describe('target select cases', () => {
  test('--target=all', async () => {
    await testRunner({
      inputFile: `${__dirname}/../test-data/target-option-test/input.txt`,
      expectFile: `${__dirname}/../test-data/target-option-test/all-expects.json`,
      geocode: {
        outputFormat: OutputFormat.JSON,
        searchTarget: SearchTarget.ALL,
      }
    });
  });
  test('--target=residential', async () => {
    await testRunner({
      inputFile: `${__dirname}/../test-data/target-option-test/input.txt`,
      expectFile: `${__dirname}/../test-data/target-option-test/residential-expects.json`,
      geocode: {
        outputFormat: OutputFormat.JSON,
        searchTarget: SearchTarget.RESIDENTIAL,
      }
    });
  });
  test('--target=parcel', async () => {
    await testRunner({
      inputFile: `${__dirname}/../test-data/target-option-test/input.txt`,
      expectFile: `${__dirname}/../test-data/target-option-test/parcel-expects.json`,
      geocode: {
        outputFormat: OutputFormat.JSON,
        searchTarget: SearchTarget.PARCEL,
      }
    });
  });
  
});
