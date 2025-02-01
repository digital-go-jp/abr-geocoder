import { SearchTarget } from "@domain/types/search-target";
import { describe, expect, jest, test } from "@jest/globals";
// import { setImmediateSpy } from '@mock/global';
import { Transform } from "stream";
import { AbrGeocoder } from "../abr-geocoder";
import { AbrGeocoderDiContainer, AbrGeocoderDiContainerParams } from "../models/abr-geocoder-di-container";
import { GeocodeTransform } from "../worker/geocode-worker";

// @usecases/geocode/models/__mocks__/abr-geocoder-di-container
jest.mock("@usecases/geocode/models/abr-geocoder-di-container");

// @usecases/geocode/worker/__mocks__/geocode-worker
jest.mock("@usecases/geocode/worker/geocode-worker");

// @domain/services/thread/__mocks__/worker-thread-pool
jest.mock("@domain/services/thread/worker-thread-pool");

jest.mock("@usecases/geocode/models/city-and-ward-trie-finder");
jest.mock("@usecases/geocode/models/county-and-city-trie-finder");
jest.mock("@usecases/geocode/models/kyoto-street-trie-finder");
jest.mock("@usecases/geocode/models/oaza-cho-trie-finder");
jest.mock("@usecases/geocode/models/parcel-trie-finder");
jest.mock("@usecases/geocode/models/pref-trie-finder");
jest.mock("@usecases/geocode/models/rsdt-blk-trie-finder");
jest.mock("@usecases/geocode/models/rsdt-dsp-trie-finder");
jest.mock("@usecases/geocode/models/tokyo23-town-finder");
jest.mock("@usecases/geocode/models/tokyo23-ward-trie-finder");
jest.mock("@usecases/geocode/models/ward-and-oaza-trie-finder");
jest.mock("@usecases/geocode/models/ward-trie-finder");
jest.mock("@domain/services/thread/shared-memory");

const container = new AbrGeocoderDiContainer({} as AbrGeocoderDiContainerParams);

describe('AbrGeocoder', () => {

  test('should involve the geocodeTransformOnMainThread.pipe() method', async () => {

    // AbrGeocoderクラスの作成
    const abrGeocoder = await AbrGeocoder.create({
      container,
      numOfThreads: 3,
      isSilentMode: false,
    });

    // ジオコーディングを行う
    const input = {
      address: '/abr-geocoder/passthrough',
      searchTarget: SearchTarget.ALL,
      fuzzy: '?',
      tag: 'something',
    };
    const result = await abrGeocoder.geocode(input);

    // このテストでは、setImmediate()をモック化していないので、
    // メインスレッドのGeocodeTransformが使用されるはず。
    const mockGeoTransform = jest.mocked(GeocodeTransform);
    const mockCreate = mockGeoTransform.create;
    const mockPool = await (mockCreate.mock.results.at(-1)?.value) as jest.Mocked<Transform>;
    expect(mockPool._write).toBeCalled();

    const chunk = mockPool._write.mock.calls[0][0];
    expect(chunk).toMatchObject({
      data: input,
    });

    // 入力値と同じ値が返ってくることを期待
    expect(result).toMatchObject({
      input: {
        data: input,
      },
    });
  });

});
