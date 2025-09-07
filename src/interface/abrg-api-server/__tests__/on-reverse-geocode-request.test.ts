/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { SearchTarget } from "@domain/types/search-target";
import { MatchLevel } from "@domain/types/geocode/match-level";
import { describe, expect, jest, test, beforeEach } from "@jest/globals";
import { StatusCodes } from "http-status-codes";
import { OnReverseGeocodeRequest } from "../on-reverse-geocode-request";

describe('OnReverseGeocodeRequest', () => {
  let mockGeocoder: any;
  let mockRequest: any;
  let mockResponse: any;
  let onReverseGeocodeRequest: OnReverseGeocodeRequest;

  beforeEach(() => {
    // Mock AbrGeocoder
    mockGeocoder = {
      reverseGeocode: jest.fn(),
      getDbVersion: jest.fn().mockResolvedValue('20240501'),
    };

    // Mock Request
    mockRequest = {
      query_parameters: {},
    };

    // Mock Response
    mockResponse = {
      setDefaultEncoding: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      type: jest.fn(),
    };

    onReverseGeocodeRequest = new OnReverseGeocodeRequest(mockGeocoder);
  });

  test('should return error when lat parameter is missing', async () => {
    mockRequest.query_parameters = { lon: '139.736394597' };

    await onReverseGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST, 'lat is required');
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'The lat parameter is required',
    });
  });

  test('should return error when lon parameter is missing', async () => {
    mockRequest.query_parameters = { lat: '35.679107172' };

    await onReverseGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST, 'lon is required');
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'The lon parameter is required',
    });
  });

  test('should return error when lat parameter is invalid', async () => {
    mockRequest.query_parameters = { lat: 'invalid', lon: '139.736394597' };

    await onReverseGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST, 'lat is invalid');
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'The lat parameter must be a number between -90 and 90',
    });
  });

  test('should return error when lat parameter is out of range', async () => {
    mockRequest.query_parameters = { lat: '91', lon: '139.736394597' };

    await onReverseGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST, 'lat is invalid');
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'The lat parameter must be a number between -90 and 90',
    });
  });

  test('should return error when lon parameter is invalid', async () => {
    mockRequest.query_parameters = { lat: '35.679107172', lon: 'invalid' };

    await onReverseGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST, 'lon is invalid');
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'The lon parameter must be a number between -180 and 180',
    });
  });

  test('should return error when lon parameter is out of range', async () => {
    mockRequest.query_parameters = { lat: '35.679107172', lon: '181' };

    await onReverseGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST, 'lon is invalid');
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'The lon parameter must be a number between -180 and 180',
    });
  });

  test('should return error when limit parameter is invalid', async () => {
    mockRequest.query_parameters = { 
      lat: '35.679107172', 
      lon: '139.736394597',
      limit: 'invalid',
    };

    await onReverseGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST, 'limit is invalid');
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'The limit parameter must be an integer between 1 and 5',
    });
  });

  test('should return error when target parameter is invalid', async () => {
    mockRequest.query_parameters = { 
      lat: '35.679107172', 
      lon: '139.736394597',
      target: 'invalid',
    };

    await onReverseGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST, 'target is invalid');
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'The target parameter must be one of: all, residential, parcel',
    });
  });

  test('should return successful GeoJSON response with valid parameters', async () => {
    const mockResults = [{
      rep_lat: '35.679107172',
      rep_lon: '139.736394597',
      distance: 5.7,
      formatted: { address: '東京都千代田区紀尾井町1-3' },
      match_level: MatchLevel.RESIDENTIAL_DETAIL,
      lg_code: '131016',
      machiaza_id: '0056000',
      rsdt_addr_flg: 1,
      block_id: '001',
      rsdt_id: '003',
      rsdt2_id: null,
      prc_id: null,
      pref: '東京都',
      county: null,
      city: '千代田区',
      ward: null,
      oaza_cho: '紀尾井町',
      chome: null,
      koaza: null,
      block: '1',
      rsdt_num: 3,
      rsdt_num2: null,
      prc_num1: null,
      prc_num2: null,
      prc_num3: null,
    }];

    mockGeocoder.reverseGeocode.mockResolvedValue(mockResults);

    mockRequest.query_parameters = { 
      lat: '35.679107172', 
      lon: '139.736394597',
      limit: '2',
      target: 'all',
    };

    await onReverseGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockGeocoder.reverseGeocode).toHaveBeenCalledWith({
      lat: 35.679107172,
      lon: 139.736394597,
      limit: 2,
      searchTarget: SearchTarget.ALL,
    });

    expect(mockResponse.type).toHaveBeenCalledWith('application/geo+json');
    expect(mockResponse.json).toHaveBeenCalledWith({
      type: "FeatureCollection",
      query: {
        lat: 35.679107172,
        lon: 139.736394597,
        limit: 2,
        target: SearchTarget.ALL,
      },
      result_info: {
        count: 1,
        limit: 2,
        api_version: "3.0.0",
        db_version: "20240501",
      },
      features: [{
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [139.736394597, 35.679107172],
        },
        properties: {
          formatted_address: '東京都千代田区紀尾井町1-3',
          match_level: 'residential_detail',
          distance: 5.7,
          ids: {
            lg_code: '131016',
            machiaza_id: '0056000',
            rsdt_addr_flg: 1,
            blk_id: '001',
            rsdt_id: '003',
            rsdt2_id: null,
            prc_id: null,
          },
          structured_address: {
            pref: '東京都',
            county: null,
            city: '千代田区',
            ward: null,
            oaza_cho: '紀尾井町',
            chome: null,
            koaza: null,
            blk_num: '1',
            rsdt_num: '3',
            rsdt_num2: null,
            prc_num1: null,
            prc_num2: null,
            prc_num3: null,
          },
        },
      }],
    });
  });

  test('should use default values when optional parameters are not provided', async () => {
    const mockResults: any[] = [];
    mockGeocoder.reverseGeocode.mockResolvedValue(mockResults);

    mockRequest.query_parameters = { 
      lat: '35.679107172', 
      lon: '139.736394597',
    };

    await onReverseGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockGeocoder.reverseGeocode).toHaveBeenCalledWith({
      lat: 35.679107172,
      lon: 139.736394597,
      limit: 1,
      searchTarget: SearchTarget.ALL,
    });

    expect(mockResponse.json).toHaveBeenCalledWith({
      type: "FeatureCollection",
      query: {
        lat: 35.679107172,
        lon: 139.736394597,
        limit: 1,
        target: SearchTarget.ALL,
      },
      result_info: {
        count: 0,
        limit: 1,
        api_version: "3.0.0",
        db_version: "20240501",
      },
      features: [],
    });
  });
});

