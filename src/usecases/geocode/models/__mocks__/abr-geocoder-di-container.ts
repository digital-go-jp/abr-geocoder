import { Sqlite3Params } from '@domain/types/database-params';
import { SearchTarget } from '@domain/types/search-target';
import { jest } from '@jest/globals';

const database: Sqlite3Params = {
  type: 'sqlite3',
  dataDir: '~/.abr-geocoder/database_test',
  schemaDir: '../schema',
};

const originalModule = jest.requireActual('@usecases/geocode/models/abr-geocoder-di-container');

module.exports = {
  ...Object.assign({}, originalModule),
  AbrGeocoderDiContainer: jest.fn(() => {
    return {
      // seachTargetのデフォルト値
      searchTarget: SearchTarget.ALL,

      // モック化されたデータベース
      database: {
        connectParams: database,
      },

      // 使用しているので、モックの値を返す
      toJSON: () => {
        return {
          database,
          debug: false,
        };
      },

      logger: undefined,
    };
  }),
};
