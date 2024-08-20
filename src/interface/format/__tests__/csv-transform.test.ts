import { beforeAll, describe, expect, test } from "@jest/globals";
import { CsvTransform } from '../csv-transform';
import { SearchTarget } from "../../../domain/types/search-target";
import { MatchLevel } from "../../../domain/types/geocode/match-level";
import { FormattedAddres, QueryInput } from "@usecases/geocode/models/query";

const convertToObject = (keys: string[], csvLine: string): Record<string, string> => {
  const values = csvLine.split(',');
  // ダブルクォート削除
  const cleanedValues = values.map(value => value.replace(/^"|"$/g, ''));

  const result: Record<string, string> = {};
  keys.forEach((key, index) => {
    result[key] = cleanedValues[index] || '';
  });

  return result;
};

class MockQuery {
  input?: QueryInput;
  formatted?: FormattedAddres;
  match_level?: MatchLevel;
  coordinate_level?: MatchLevel;
  rep_lat?: number;
  rep_lon?: number;
  lg_code?: string;
  pref?: string;
  city?: string;
  startTime?: number;
  pref_key?: number;
  city_key?: number;
  town_key?: number;
  parcel_key?: number;
  rsdtblk_key?: number;
  rsdtdsp_key?: number;

  constructor(data: Partial<MockQuery> = {}) {
    // デフォルトのダミー値
    this.input = {
      taskId: 1,
      lineId: 1,
      data: {
        address: '東京都千代田区',
        searchTarget: SearchTarget.ALL,
      }
    };
    this.formatted = {
      address: '東京都千代田区',
      score: 1,
    };
    this.match_level = MatchLevel.CITY;
    this.coordinate_level = MatchLevel.CITY;
    this.rep_lat = 35.6895;
    this.rep_lon = 139.6917;
    this.lg_code = '13101';
    this.pref = '東京都';
    this.city = '千代田区';
    this.startTime = Date.now();

    if (Object.hasOwn(data, 'input')) {
      this.input = data.input;
    }
    if (Object.hasOwn(data, 'formatted')) {
      this.formatted = data.formatted;
    }
    if (Object.hasOwn(data, 'match_level')) {
      this.match_level = data.match_level;
    }
    if (Object.hasOwn(data, 'coordinate_level')) {
      this.coordinate_level = data.coordinate_level;
    }
    if (Object.hasOwn(data, 'rep_lat')) {
      this.rep_lat = data.rep_lat;
    }
    if (Object.hasOwn(data, 'rep_lon')) {
      this.rep_lon = data.rep_lon;
    }
    if (Object.hasOwn(data, 'lg_code')) {
      this.lg_code = data.lg_code;
    }
    if (Object.hasOwn(data, 'pref')) {
      this.pref = data.pref;
    }
    if (Object.hasOwn(data, 'city')) {
      this.city = data.city;
    }
    if (Object.hasOwn(data, 'startTime')) {
      this.startTime = data.startTime;
    }
    if (Object.hasOwn(data, 'pref_key')) {
      this.pref_key = data.pref_key;
    }
    if (Object.hasOwn(data, 'city_key')) {
      this.city_key = data.city_key;
    }
    if (Object.hasOwn(data, 'town_key')) {
      this.town_key = data.town_key;
    }
    if (Object.hasOwn(data, 'parcel_key')) {
      this.parcel_key = data.parcel_key;
    }
    if (Object.hasOwn(data, 'rsdtblk_key')) {
      this.rsdtblk_key = data.rsdtblk_key;
    }
    if (Object.hasOwn(data, 'rsdtdsp_key')) {
      this.rsdtdsp_key = data.rsdtdsp_key;
    }
  }
}

describe('CsvTransform', () => {
  let csvTransform: CsvTransform;

  beforeAll(() => {
    csvTransform = new CsvTransform({
      columns: CsvTransform.DEFAULT_COLUMNS,
      skipHeader: false,
    });
  });

  test('should have correct type', () => {
    expect(csvTransform.mimetype).toBe('text/x-csv');
  });

  test('should not create CSV header when skipHeader is true', (done) => {
    const noHeaderTransform = new CsvTransform({
      columns: ['id', 'input', 'output'],
      skipHeader: true,
    });

    const chunks: Buffer[] = [];
    noHeaderTransform.on('data', (chunk: Buffer) => chunks.push(chunk));
    noHeaderTransform.on('end', () => {
      const result = Buffer.concat(chunks).toString();
      expect(result.trim()).toBe('');
      done();
    });

    noHeaderTransform.end();
  });

  test('should transform Query object to CSV line', (done) => {
    const mockQuery = new MockQuery();

    const chunks: Buffer[] = [];
    csvTransform.on('data', (chunk: Buffer) => chunks.push(chunk));
    csvTransform.on('end', () => {
      const result = Buffer.concat(chunks).toString();
      const lines = result.trim().split('\n');
      expect(lines.length).toBe(2); // Header + data line

      const column = lines[0].split(',');
      const dataObject = convertToObject(column, lines[1]);

      const expectedFields = {
        input: '東京都千代田区',
        output: '東京都千代田区',
        score: '1',
        match_level: MatchLevel.CITY.str,
        coordinate_level: MatchLevel.CITY.str,
        lat: '35.6895',
        lon: '139.6917',
        lg_code: '13101',
        pref: '東京都',
        city: '千代田区'
      };

      // valueの検証
      expect(dataObject).toMatchObject(expectedFields);

      // keyの検証（valueのないcolumnも含む）
      expect(Object.keys(dataObject)).toEqual(CsvTransform.DEFAULT_COLUMNS);

      done();
    });

    csvTransform.write(mockQuery);
    csvTransform.end();
  });

  test('should throw error for unimplemented field', () => {
    const invalidTransform = new CsvTransform({
      columns: ['invalid_field'],
      skipHeader: true,
    });

    const mockQuery = new MockQuery();

    expect(() => {
      invalidTransform.write(mockQuery);
    }).toThrow('Unimplemented field : invalid_field');
  });
});
