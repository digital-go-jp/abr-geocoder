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
import { OutputFormat } from "@domain/types/output-format";
import { describe, expect, jest, test, beforeEach } from "@jest/globals";
import { StatusCodes } from "http-status-codes";
import { OnGeocodeRequest } from "../on-geocode-request";
import { FormatterProvider } from "@interface/format/formatter-provider";
import { EnvProvider } from "@domain/models/env-provider";

// Mock dependencies
jest.mock("@interface/format/formatter-provider");
jest.mock("@domain/models/env-provider");

describe('OnGeocodeRequest', () => {
  let mockGeocoder: any;
  let mockRequest: any;
  let mockResponse: any;
  let mockFormatter: any;
  let onGeocodeRequest: OnGeocodeRequest;

  beforeEach(() => {
    // Mock AbrGeocoder
    mockGeocoder = {
      geocode: jest.fn(),
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
      send: jest.fn(),
      type: jest.fn(),
    };

    // Mock Formatter
    mockFormatter = {
      mimetype: 'application/json',
      pipe: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };

    // Setup FormatterProvider mock
    const MockFormatterProvider = jest.mocked(FormatterProvider);
    MockFormatterProvider.get = jest.fn().mockReturnValue(mockFormatter);

    // Setup EnvProvider mock
    const MockEnvProvider = jest.mocked(EnvProvider);
    Object.defineProperty(MockEnvProvider, 'isDebug', {
      value: false,
      writable: true,
    });

    onGeocodeRequest = new OnGeocodeRequest(mockGeocoder);
  });

  test('should return error when address parameter is missing', async () => {
    mockRequest.query_parameters = {};

    await onGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST, 'address is empty');
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'The address paramaeter is empty',
    });
  });

  test('should return error when address parameter is empty', async () => {
    mockRequest.query_parameters = { address: '' };

    await onGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST, 'address is empty');
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'The address paramaeter is empty',
    });
  });

  test('should return error when target parameter is invalid', async () => {
    mockRequest.query_parameters = { 
      address: '東京都千代田区',
      target: 'invalid',
    };

    await onGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST, 'target is invalid');
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'The target paramaeter is invalid',
    });
  });

  test('should return error when fuzzy parameter is invalid', async () => {
    mockRequest.query_parameters = { 
      address: '東京都千代田区',
      fuzzy: 'invalid',
    };

    await onGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST, 'fuzzy is invalid');
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'The fuzzy paramaeter is invalid',
    });
  });

  test('should return error when format parameter is invalid', async () => {
    mockRequest.query_parameters = { 
      address: '東京都千代田区',
      format: 'invalid',
    };

    await onGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST, 'format is invalid');
    expect(mockResponse.send).toHaveBeenCalledWith('format is invalid');
  });

  test('should process valid geocoding request', async () => {
    const mockResult = {
      pref: '東京都',
      city: '千代田区',
      formatted: { address: '東京都千代田区' },
    };

    mockGeocoder.geocode.mockResolvedValue(mockResult);

    mockRequest.query_parameters = { 
      address: '東京都千代田区',
    };

    await onGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockGeocoder.geocode).toHaveBeenCalledWith({
      address: '東京都千代田区',
      tag: undefined,
      searchTarget: SearchTarget.ALL,
      fuzzy: undefined,
    });

    expect(FormatterProvider.get).toHaveBeenCalledWith({
      type: 'json',
      debug: false,
    });

    expect(mockResponse.type).toHaveBeenCalledWith('application/json');
    expect(mockFormatter.pipe).toHaveBeenCalledWith(mockResponse);
    expect(mockFormatter.write).toHaveBeenCalledWith(mockResult);
    expect(mockFormatter.end).toHaveBeenCalled();
  });

  test('should use custom parameters when provided', async () => {
    const mockResult = {
      pref: '東京都',
      city: '千代田区',
      formatted: { address: '東京都千代田区' },
    };

    mockGeocoder.geocode.mockResolvedValue(mockResult);

    mockRequest.query_parameters = { 
      address: '東京都千代田区',
      target: SearchTarget.RESIDENTIAL,
      fuzzy: '*',
      format: 'csv',
      debug: 'true',
    };

    await onGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockGeocoder.geocode).toHaveBeenCalledWith({
      address: '東京都千代田区',
      tag: undefined,
      searchTarget: SearchTarget.RESIDENTIAL,
      fuzzy: '*',
    });

    expect(FormatterProvider.get).toHaveBeenCalledWith({
      type: 'csv',
      debug: true,
    });
  });

  test('should use debug mode when EnvProvider.isDebug is true', async () => {
    const mockResult = {
      pref: '東京都',
      city: '千代田区',
      formatted: { address: '東京都千代田区' },
    };

    mockGeocoder.geocode.mockResolvedValue(mockResult);

    // Set EnvProvider.isDebug to true
    Object.defineProperty(EnvProvider, 'isDebug', {
      value: true,
      writable: true,
    });

    mockRequest.query_parameters = { 
      address: '東京都千代田区',
    };

    await onGeocodeRequest.run(mockRequest, mockResponse);

    expect(FormatterProvider.get).toHaveBeenCalledWith({
      type: 'json',
      debug: true,
    });
  });

  test('should validate fuzzy parameter correctly', async () => {
    const mockResult = {
      pref: '東京都',
      city: '千代田区',
      formatted: { address: '東京都千代田区' },
    };

    mockGeocoder.geocode.mockResolvedValue(mockResult);

    mockRequest.query_parameters = { 
      address: '東京都千代田区',
      fuzzy: '?',
    };

    await onGeocodeRequest.run(mockRequest, mockResponse);

    expect(mockGeocoder.geocode).toHaveBeenCalledWith({
      address: '東京都千代田区',
      tag: undefined,
      searchTarget: SearchTarget.ALL,
      fuzzy: '?',
    });
  });
});
