import { City } from '@domain/city';
import { Prefecture } from '@domain/prefecture';
import { PrefectureName } from '@domain/prefecture-name';
import { describe, expect, it, jest } from '@jest/globals';
import { default as BetterSqlite3, default as Database } from 'better-sqlite3';
import { getPrefecturesFromDB } from '../get-prefectures-from-db';

jest.mock<BetterSqlite3.Database>('better-sqlite3');

const MockedDB = Database as unknown as jest.Mock;

MockedDB.mockImplementation(() => {
  return {
    prepare: (sql: string) => {
      return {
        all: (params: {
          prefecture?: PrefectureName;
          city?: string;
          town?: string;
        }) => {
          return [
            {
              'name': '佐賀県',
              'cities': '[{"name":"佐賀市","lg_code":"412015"},{"name":"藤津郡太良町","lg_code":"414417"}]',
            },

            {
              'name': '富山県',
              'cities': '[{"name":"富山市","lg_code":"162019"},{"name":"下新川郡朝日町","lg_code":"163431"}]',
            }
          ];
        }
      }
    },
  };
});
describe('getPrefecturesFromDB', () => {

  it('should return prefectures as Prefecture[]', async () => {
    const mockedDB = new Database('<no sql file>');
    const prefectures = await getPrefecturesFromDB({
      db: mockedDB,
    });
    expect(prefectures).toEqual([
      new Prefecture({
        name: PrefectureName.SAGA,
        cities: [
          new City({
            'name':'佐賀市',
            'lg_code':'412015',
          }),
          new City({
            'name':'藤津郡太良町',
            'lg_code':'414417',
          }),
        ]
      }),

      new Prefecture({
        name: PrefectureName.TOYAMA,
        cities: [
          new City({
            'name':'富山市',
            'lg_code':'162019',
          }),
          new City({
            'name':'下新川郡朝日町',
            'lg_code':'163431',
          }),
        ]
      }),
    ])
  })
});