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
    success: true,
    result: [
      "ba000001",
      "ba000002",
      "ba-o1-000000_g2-000001",
      "ba-o1-000000_g2-000002",
      "ba-o1-000000_g2-000003",
      "ba-o1-000000_g2-000009",
      "ba-o1-000000_g2-000012",
      "ba-o1-000000_g2-000013",
      "ba-o1-000000_g2-000026",
      "ba-o1-130001_g2-000008",
      "ba-o1-130001_g2-000009",
      "ba-o1-130001_g2-000013",
      "ba-o1-131016_g2-000003",
      "ba-o1-131016_g2-000004",
      "ba-o1-131016_g2-000005",
      "ba-o1-131016_g2-000006",
      "ba-o1-131016_g2-000007",
      "ba-o1-131016_g2-000008",
      "ba-o1-131016_g2-000009",
      "ba-o1-131016_g2-000010",
      "ba-o1-131016_g2-000011",
      "ba-o1-131024_g2-000003",
      "ba-o1-131024_g2-000004",
      "ba-o1-260002_g2-000002",
      "ba-o1-260002_g2-000003",
      "ba-o1-260002_g2-000004",
      "ba-o1-260002_g2-000005",
      "ba-o1-260002_g2-000006",
      "ba-o1-260002_g2-000007",
      "ba-o1-260002_g2-000008",
      "ba-o1-260002_g2-000009",
      "ba-o1-260002_g2-000013",
      "ba-o1-262013_g2-000003",
      "ba-o1-262013_g2-000004",
      "ba-o1-262013_g2-000006",
      "ba-o1-262013_g2-000007",
      "ba-o1-262013_g2-000009",
      "ba-o1-262013_g2-000010",
      "ba-o1-262013_g2-000011",
      "ba-o1-262021_g2-000003",
      "ba-o1-262021_g2-000004",
      "ba-o1-262021_g2-000006",
      "ba-o1-262021_g2-000007",
      "ba-o1-262021_g2-000009",
      "ba-o1-262021_g2-000010",
      "ba-o1-262021_g2-000011",
      "ba-o1-262030_g2-000003",
      "ba-o1-262030_g2-000004",
      "ba-o1-262030_g2-000006",
      "ba-o1-262030_g2-000007",
      "ba-o1-262030_g2-000009",
      "ba-o1-262030_g2-000010",
      "ba-o1-262030_g2-000011",
      "cn000001",
      "ed000001",
      "ed000030",
      "ed000040",
      "ed000080",
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
    success: false,
    result: [],
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
