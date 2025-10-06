import { GetJsonOptions } from '@interface/http-request-adapter';
import { jest } from '@jest/globals';
import { StatusCodes } from 'http-status-codes';

const PackageListResponse = {
  header: {
    statusCode: StatusCodes.OK,
    contentLength: 100,
    eTag: '"dummy_etag"',
    lastModified: 'Tuesday, December 16, 2017 11:09:42',
    contentRange: 'bytes 200-1000/67589',
  },
  body: {
    dataset: [
      // 全国データ (000000)
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_pref/mt_pref_all.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_pref_pos/mt_pref_pos_all.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_city/mt_city_all.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_city_pos/mt_city_pos_all.csv.zip" }] },

      // 東京都データ (13....)
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_rsdtdsp_rsdt_pos/pref/mt_rsdtdsp_rsdt_pos_pref13.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_city_pos/pref/mt_city_pos_pref13.csv.zip" }] },

      // 東京都千代田区 (131016)
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_town/city/mt_town_city131016.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_town_pos/city/mt_town_pos_city131016.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_rsdtdsp_blk/city/mt_rsdtdsp_blk_city131016.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_rsdtdsp_blk_pos/city/mt_rsdtdsp_blk_pos_city131016.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_rsdtdsp_rsdt/city/mt_rsdtdsp_rsdt_city131016.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_rsdtdsp_rsdt_pos/city/mt_rsdtdsp_rsdt_pos_city131016.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_parcel/city/mt_parcel_city131016.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_parcel_pos/city/mt_parcel_pos_city131016.csv.zip" }] },

      // 京都府データ (26....)
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_city/pref/mt_city_pref26.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_city_pos/pref/mt_city_pos_pref26.csv.zip" }] },

      // 京都府福知山市 (262013)
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_town/city/mt_town_city262013.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_town_pos/city/mt_town_pos_city262013.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_rsdtdsp_blk/city/mt_rsdtdsp_blk_city262013.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_rsdtdsp_blk_pos/city/mt_rsdtdsp_blk_pos_city262013.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_parcel/city/mt_parcel_city262013.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_parcel_pos/city/mt_parcel_pos_city262013.csv.zip" }] },

      // 京都府舞鶴市 (262021)
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_town/city/mt_town_city262021.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_town_pos/city/mt_town_pos_city262021.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_rsdtdsp_blk/city/mt_rsdtdsp_blk_city262021.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_rsdtdsp_blk_pos/city/mt_rsdtdsp_blk_pos_city262021.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_parcel/city/mt_parcel_city262021.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_parcel_pos/city/mt_parcel_pos_city262021.csv.zip" }] },

      // 京都府綾部市 (262030)
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_town/city/mt_town_city262030.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_town_pos/city/mt_town_pos_city262030.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_rsdtdsp_blk/city/mt_rsdtdsp_blk_city262030.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_rsdtdsp_blk_pos/city/mt_rsdtdsp_blk_pos_city262030.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_parcel/city/mt_parcel_city262030.csv.zip" }] },
      { description: "最終更新日: 2025-09-30T15:41:43.000Z", distribution: [{ accessURL: "https://example.com/mt_parcel_pos/city/mt_parcel_pos_city262030.csv.zip" }] },
    ],
  },
};

const ErrorStauts404 = {
  header: {
    statusCode: StatusCodes.NOT_FOUND,
    contentLength: 0,
  },
  body: {
    success: false,
    result: [],
  },
};

const ErrorResponse = {
  header: {
    statusCode: StatusCodes.OK,
    contentLength: 100,
  },
  body: {
    dataset: [],
  },
};

const originalModule = jest.requireActual('@interface/http-request-adapter');

module.exports = {
  ...Object.assign({}, originalModule),
  HttpRequestAdapter: jest.fn().mockImplementation(() => {
    return {
      getJSON: (params: GetJsonOptions) => {
        switch (params.url.toString()) {
          case 'http://localhost/api/feed/dcat-us/1.1.json':
            return Promise.resolve(PackageListResponse);

          case 'http://localhost/404_url':
            return Promise.resolve(ErrorStauts404);
        }
        return Promise.resolve(ErrorResponse);
      },
      close: () => {},
    };
  }),
};
