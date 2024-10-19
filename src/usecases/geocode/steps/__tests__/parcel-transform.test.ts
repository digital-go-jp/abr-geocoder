import { DASH, DEFAULT_FUZZY_CHAR } from "@config/constant-values";
import { MatchLevel } from "@domain/types/geocode/match-level";
import { ParcelInfo } from "@domain/types/geocode/parcel-info";
import { SearchTarget } from "@domain/types/search-target";
import { GeocodeDbController } from "@interface/database/__mocks__/geocode-db-controller";
import { IParcelDbGeocode } from "@interface/database/common-db";
import { describe, expect, jest, test } from '@jest/globals';
import { Query } from "@usecases/geocode/models/query";
import { QuerySet } from "@usecases/geocode/models/query-set";
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ParcelTransform } from "../parcel-transform";

jest.mock('@interface/database/geocode-db-controller');

const dbCtrl = new GeocodeDbController({
  connectParams: {
    type: 'sqlite3',
    dataDir: 'somewhere',
    schemaDir: 'somewhere',
  },
});

const parcelDb: jest.Mocked<IParcelDbGeocode> = {
  closeDb: jest.fn(),
  getParcelRows: jest.fn<IParcelDbGeocode["getParcelRows"]>().mockImplementation(async (params): Promise<ParcelInfo[]> => {
    switch (true) {
      case params.town_key === 2758760445: {
        return [
          {
            parcel_key: 685855111,
            prc_id: "000050000000000",
            prc_num1: "5",
            prc_num2: "",
            prc_num3: "",
            rep_lat: '43.058730899',
            rep_lon: '141.356421455',
          },
        ];
      }

      default:
        throw 'Not implemented yet';
    }
  }),
};

jest.mocked(dbCtrl.openParcelDb)
  .mockReturnValue(Promise.resolve(parcelDb));

// querySet をテストする
const doStreamTest = async (querySet: QuerySet): Promise<QuerySet> => {
  const reader = Readable.from([querySet], {
    objectMode: true,
  });

  const parcelTransform = new ParcelTransform(dbCtrl);

  const results: QuerySet[] = [];
  await pipeline(
    reader,
    parcelTransform,
    new Writable({
      objectMode: true,
      write(querySet: QuerySet, _, callback) {
        results.push(querySet);
        callback();
      },
    }),
  );

  return results[0];
};
describe('ParcelTransform', () => {

  // issue 157
  test('should keep the floor number (edge case)', async () => {
    // クエリを作成
    const querySet = new QuerySet();
    const baseQuery = Query.create({
      data: {
        address: "札幌市中央区南２条西１ー５ー３F",
        searchTarget: SearchTarget.ALL,
        fuzzy: undefined,
        tag: undefined,
      },
      taskId: 0,
    });
    const tempAddress = CharNode.create(`5${DASH}3F`);
    
    querySet.add(baseQuery.copy({
      ambiguousCnt: 0,
      chome: '一丁目',
      city: '札幌市',
      city_key: 3783623301,
      coordinate_level: MatchLevel.MACHIAZA_DETAIL,
      county: '',
      fuzzy: DEFAULT_FUZZY_CHAR,
      koaza: '',
      lg_code: '011011',
      machiaza_id: '0060001',
      match_level: MatchLevel.MACHIAZA_DETAIL,
      matchedCnt: 12,
      oaza_cho: '南二条西',
      pref: '北海道',
      pref_key: 5859364,
      rep_lat: '43.05842',
      rep_lon: '141.357046',
      tempAddress,
      town_key: 2758760445,
      ward: '中央区',
      rsdt_addr_flg: 0,
    }));

    // テストを行う
    const results = await doStreamTest(querySet);
    const queries = Array.from(results.values());
    expect(queries.length).toBe(1);

    // ヒットした場合
    expect(queries[0].toJSON()).toMatchObject({
      parcel_key: 685855111,
      prc_num1: "5",
      prc_num2: "",
      prc_num3: "",
      prc_id: "000050000000000",
      rsdt_addr_flg: 0,
      match_level: MatchLevel.PARCEL,
      coordinate_level: MatchLevel.PARCEL,
      matchedCnt: 15,
      ambiguousCnt: 0,
    });
    expect(queries[0].tempAddress?.toProcessedString()).toBe("3F");
  });

  // issue 157
  test('should keep the room number (edge case)', async () => {
    // クエリを作成
    const querySet = new QuerySet();
    const baseQuery = Query.create({
      data: {
        address: "札幌市中央区南２条西１ー５ー３０３号室",
        searchTarget: SearchTarget.ALL,
        fuzzy: undefined,
        tag: undefined,
      },
      taskId: 0,
    });
    const tempAddress = CharNode.create(`5${DASH}303号室`);
    
    querySet.add(baseQuery.copy({
      ambiguousCnt: 0,
      chome: '一丁目',
      city: '札幌市',
      city_key: 3783623301,
      coordinate_level: MatchLevel.MACHIAZA_DETAIL,
      county: '',
      fuzzy: DEFAULT_FUZZY_CHAR,
      koaza: '',
      lg_code: '011011',
      machiaza_id: '0060001',
      match_level: MatchLevel.MACHIAZA_DETAIL,
      matchedCnt: 12,
      oaza_cho: '南二条西',
      pref: '北海道',
      pref_key: 5859364,
      rep_lat: '43.05842',
      rep_lon: '141.357046',
      tempAddress,
      town_key: 2758760445,
      ward: '中央区',
      rsdt_addr_flg: 0,
    }));

    // テストを行う
    const results = await doStreamTest(querySet);
    const queries = Array.from(results.values());
    expect(queries.length).toBe(1);

    // ヒットした場合
    expect(queries[0].toJSON()).toMatchObject({
      parcel_key: 685855111,
      prc_num1: "5",
      prc_num2: "",
      prc_num3: "",
      prc_id: "000050000000000",
      rsdt_addr_flg: 0,
      match_level: MatchLevel.PARCEL,
      coordinate_level: MatchLevel.PARCEL,
      matchedCnt: 15,
      ambiguousCnt: 0,
    });
    expect(queries[0].tempAddress?.toProcessedString()).toBe("303号室");
  });
});
