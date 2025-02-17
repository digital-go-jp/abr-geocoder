import { DownloadDbController } from '@drivers/database/download-db-controller';
import { jest } from '@jest/globals';

// '@drivers/database/__mocks__/download-db-controller'
jest.mock('@drivers/database/download-db-controller');

const database = new DownloadDbController({
  type: 'sqlite3',
  dataDir: '~/.abr-geocoder/database_test',
});

const originalModule = jest.requireActual('@usecases/geocode/models/abr-geocoder-di-container');


module.exports = {
  ...Object.assign({}, originalModule),
  AbrGeocoderDiContainer: jest.fn(() => {
    return {
      // モック化されたデータベース
      database,

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
