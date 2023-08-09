import fs from 'node:fs';
import path from 'node:path';

import {getDataDir} from '../src/config';
import {Normalize} from '../src/normalizer';
import {NormalizeResult} from '../src/engine/normalize';

type TestCase = [string, Partial<NormalizeResult>];
const cases: TestCase[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'normalizer.cases.json'), 'utf-8')
);
const fuzzyCases: TestCase[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'normalizer-fuzzy.cases.json'), 'utf-8')
);
let normalizer: Normalize;

describe('normalizer.ts', () => {
  beforeAll(async () => {
    const dataDir = await getDataDir();
    const sourceId = 'ba000001';
    normalizer = new Normalize(dataDir, sourceId);
  });

  afterAll(() => {
    normalizer.close();
  });

  for (const [addressString, expectedResult] of cases) {
    test(addressString, async () => {
      const res = await normalizer.normalizeAddress(addressString);
      expect(res).toEqual(expect.objectContaining(expectedResult));
    });
  }

  describe('fuzzy', () => {
    for (const [addressString, expectedResult] of fuzzyCases) {
      test(addressString, async () => {
        const res = await normalizer.normalizeAddress(addressString, {
          fuzzy: true,
        });
        expect(res).toEqual(expect.objectContaining(expectedResult));
      });
    }
  });
});
