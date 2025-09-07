import { SearchTarget } from "@domain/types/search-target";
import { MatchLevel } from "@domain/types/geocode/match-level";
import { describe, expect, jest, test, beforeEach } from "@jest/globals";
import { AbrGeocoder, ReverseGeocodeParams } from "../abr-geocoder";
import { AbrGeocoderDiContainer, AbrGeocoderDiContainerParams } from "../models/abr-geocoder-di-container";
import { GeocodeDbController } from "@drivers/database/geocode-db-controller";

// Mock all dependencies
jest.mock("@usecases/geocode/models/abr-geocoder-di-container");
jest.mock("@usecases/geocode/worker/geocode-worker");
jest.mock("@domain/services/thread/worker-thread-pool");
jest.mock("@drivers/database/geocode-db-controller");
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

describe('AbrGeocoder - Reverse Geocoding', () => {
  let mockDbController: Partial<GeocodeDbController>;
  let mockCommonDb: any;
  let mockRsdtDb: any;
  let mockParcelDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock database objects
    mockCommonDb = {
      prepare: jest.fn().mockReturnValue({
        all: jest.fn(),
      }),
      close: jest.fn(),
    };
    
    mockRsdtDb = {
      prepare: jest.fn().mockReturnValue({
        all: jest.fn(),
      }),
      close: jest.fn(),
    };
    
    mockParcelDb = {
      prepare: jest.fn().mockReturnValue({
        all: jest.fn(),
      }),
      close: jest.fn(),
    };

    // Setup GeocodeDbController mock
    mockDbController = {
      openCommonDb: jest.fn().mockResolvedValue(mockCommonDb),
      openRsdtBlkDb: jest.fn().mockResolvedValue(null),
      openRsdtDspDb: jest.fn().mockResolvedValue(mockRsdtDb),
      openParcelDb: jest.fn().mockResolvedValue(mockParcelDb),
      connectParams: {} as any,
    };

    const MockGeocodeDbController = jest.mocked(GeocodeDbController);
    MockGeocodeDbController.mockImplementation(() => mockDbController as GeocodeDbController);
  });

  test('should return results from admin data for basic reverse geocoding', async () => {
    // Setup mock data - town level result
    mockCommonDb.prepare().all.mockReturnValueOnce([
      {
        lg_code: '131016',
        machiaza_id: '0056000',
        oaza_cho: '紀尾井町',
        chome: null,
        koaza: null,
        rep_lat: 35.679107172,
        rep_lon: 139.736394597,
        rsdt_addr_flg: 1,
        distance: 5.7,
      }
    ]);

    const abrGeocoder = await AbrGeocoder.create({
      container,
      numOfThreads: 1,
      isSilentMode: true,
    });

    const params: ReverseGeocodeParams = {
      lat: 35.679107172,
      lon: 139.736394597,
      limit: 1,
      searchTarget: SearchTarget.ALL,
    };

    const results = await abrGeocoder.reverseGeocode(params);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      lg_code: '131016',
      oaza_cho: '紀尾井町',
      rep_lat: '35.679107172',
      rep_lon: '139.736394597',
      match_level: MatchLevel.MACHIAZA,
      distance: 5.7,
    });

    await abrGeocoder.close();
  });

  test('should search residential data when searchTarget is RESIDENTIAL', async () => {
    // Setup mock data
    mockCommonDb.prepare().all
      .mockReturnValueOnce([]) // town search - no results
      .mockReturnValueOnce([]) // city search - no results
      .mockReturnValueOnce([   // getLgCodesInRange
        { lg_code: '131016', distance: 100 }
      ]);

    mockRsdtDb.prepare().all.mockReturnValueOnce([
      {
        lg_code: '131016',
        rsdt_id: '003',
        rsdt2_id: null,
        rsdt_num: '3',
        rsdt_num2: null,
        rep_lat: 35.679107172,
        rep_lon: 139.736394597,
        distance: 2.5,
      }
    ]);

    const abrGeocoder = await AbrGeocoder.create({
      container,
      numOfThreads: 1,
      isSilentMode: true,
    });

    const params: ReverseGeocodeParams = {
      lat: 35.679107172,
      lon: 139.736394597,
      limit: 1,
      searchTarget: SearchTarget.RESIDENTIAL,
    };

    const results = await abrGeocoder.reverseGeocode(params);

    expect(mockDbController.openRsdtDspDb).toHaveBeenCalledWith({
      lg_code: '131016',
      createIfNotExists: false,
    });
    
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      rsdt_num: '3',
      match_level: MatchLevel.RESIDENTIAL_DETAIL,
      distance: 2.5,
    });

    await abrGeocoder.close();
  });

  test('should search parcel data when searchTarget is PARCEL', async () => {
    // Setup mock data
    mockCommonDb.prepare().all
      .mockReturnValueOnce([]) // town search - no results
      .mockReturnValueOnce([]) // city search - no results
      .mockReturnValueOnce([   // getLgCodesInRange
        { lg_code: '131016', distance: 100 }
      ]);

    mockParcelDb.prepare().all.mockReturnValueOnce([
      {
        lg_code: '131016',
        prc_id: 'P001',
        prc_num1: '1',
        prc_num2: '2',
        prc_num3: null,
        rep_lat: 35.679107172,
        rep_lon: 139.736394597,
        distance: 3.2,
      }
    ]);

    const abrGeocoder = await AbrGeocoder.create({
      container,
      numOfThreads: 1,
      isSilentMode: true,
    });

    const params: ReverseGeocodeParams = {
      lat: 35.679107172,
      lon: 139.736394597,
      limit: 1,
      searchTarget: SearchTarget.PARCEL,
    };

    const results = await abrGeocoder.reverseGeocode(params);

    expect(mockDbController.openParcelDb).toHaveBeenCalledWith({
      lg_code: '131016',
      createIfNotExists: false,
    });
    
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      prc_num1: '1',
      prc_num2: '2',
      match_level: MatchLevel.PARCEL,
      distance: 3.2,
    });

    await abrGeocoder.close();
  });

  test('should limit results according to limit parameter', async () => {
    // Setup mock data with multiple results
    mockCommonDb.prepare().all.mockReturnValueOnce([
      {
        lg_code: '131016',
        machiaza_id: '0056000',
        oaza_cho: '紀尾井町',
        rep_lat: 35.679107172,
        rep_lon: 139.736394597,
        rsdt_addr_flg: 1,
        distance: 5.7,
      },
      {
        lg_code: '131016',
        machiaza_id: '0056001',
        oaza_cho: '永田町',
        rep_lat: 35.679207172,
        rep_lon: 139.736494597,
        rsdt_addr_flg: 1,
        distance: 15.2,
      },
      {
        lg_code: '131016',
        machiaza_id: '0056002',
        oaza_cho: '霞が関',
        rep_lat: 35.679307172,
        rep_lon: 139.736594597,
        rsdt_addr_flg: 1,
        distance: 25.8,
      }
    ]);

    const abrGeocoder = await AbrGeocoder.create({
      container,
      numOfThreads: 1,
      isSilentMode: true,
    });

    const params: ReverseGeocodeParams = {
      lat: 35.679107172,
      lon: 139.736394597,
      limit: 2,
      searchTarget: SearchTarget.ALL,
    };

    const results = await abrGeocoder.reverseGeocode(params);

    expect(results).toHaveLength(2);
    // Results should be sorted by distance
    expect(results[0].distance).toBeLessThan(results[1].distance);
    expect(results[0].oaza_cho).toBe('紀尾井町');
    expect(results[1].oaza_cho).toBe('永田町');

    await abrGeocoder.close();
  });

  test('should handle database errors gracefully', async () => {
    // Setup mock to throw error
    mockDbController.openCommonDb.mockRejectedValue(new Error('Database error'));

    const abrGeocoder = await AbrGeocoder.create({
      container,
      numOfThreads: 1,
      isSilentMode: true,
    });

    const params: ReverseGeocodeParams = {
      lat: 35.679107172,
      lon: 139.736394597,
      limit: 1,
      searchTarget: SearchTarget.ALL,
    };

    const results = await abrGeocoder.reverseGeocode(params);

    // Should return empty array on error
    expect(results).toHaveLength(0);

    await abrGeocoder.close();
  });

  test('should handle null database connections gracefully', async () => {
    // Setup mock data
    mockCommonDb.prepare().all
      .mockReturnValueOnce([]) // town search - no results
      .mockReturnValueOnce([]) // city search - no results
      .mockReturnValueOnce([   // getLgCodesInRange
        { lg_code: '131016', distance: 100 }
      ]);

    // Return null for database connections
    mockDbController.openRsdtDspDb.mockResolvedValue(null);
    mockDbController.openParcelDb.mockResolvedValue(null);

    const abrGeocoder = await AbrGeocoder.create({
      container,
      numOfThreads: 1,
      isSilentMode: true,
    });

    const params: ReverseGeocodeParams = {
      lat: 35.679107172,
      lon: 139.736394597,
      limit: 1,
      searchTarget: SearchTarget.ALL,
    };

    const results = await abrGeocoder.reverseGeocode(params);

    // Should handle null connections and return empty results
    expect(results).toHaveLength(0);

    await abrGeocoder.close();
  });

  test('should return database version', async () => {
    const abrGeocoder = await AbrGeocoder.create({
      container,
      numOfThreads: 1,
      isSilentMode: true,
    });

    const version = await abrGeocoder.getDbVersion();
    expect(version).toBe("20240501");

    await abrGeocoder.close();
  });
});