import { beforeAll, describe, expect, test } from "@jest/globals";
import { CsvTransform } from '../csv-transform';
import { SearchTarget } from "../../../domain/types/search-target";
import { MatchLevel } from "../../../domain/types/geocode/match-level";

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
    input: any;
    formatted: any;
    match_level: any;
    coordinate_level: any;
    rep_lat: number | null | undefined;
    rep_lon: number | null | undefined;
    lg_code: string | undefined;
    pref: string | undefined;
    city: string | undefined;
    startTime: number | undefined;
    pref_key?: number;
    city_key?: number;
    town_key?: number;
    parcel_key?: number;
    rsdtblk_key?: number;
    rsdtdsp_key?: number;

    constructor(data: Partial<MockQuery> = {}) {
        Object.assign(this, {
            input: { taskId: 1, lineId: 1, data: { address: '東京都千代田区', searchTarget: SearchTarget.ALL } },
            formatted: { address: '東京都千代田区', score: 1 },
            match_level: MatchLevel.CITY,
            coordinate_level: MatchLevel.CITY,
            rep_lat: 35.6895,
            rep_lon: 139.6917,
            lg_code: '13101',
            pref: '東京都',
            city: '千代田区',
            startTime: Date.now(),
            ...data
        });
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
})
