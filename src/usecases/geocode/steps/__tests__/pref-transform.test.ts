import { DEFAULT_FUZZY_CHAR } from "@config/constant-values";
import { MatchLevel } from "@domain/types/geocode/match-level";
import { PrefInfo } from "@domain/types/geocode/pref-info";
import { PrefLgCode } from "@domain/types/pref-lg-code";
import { SearchTarget } from "@domain/types/search-target";
import { describe, expect, test } from "@jest/globals";
import { Query } from "@usecases/geocode/models/query";
import { QuerySet } from "@usecases/geocode/models/query-set";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { PrefTransform } from "../pref-transform";

const prefList: PrefInfo[] = [
  {
    pref: '長野県',
    pref_key: 1,
    lg_code: PrefLgCode.NAGANO,
    rep_lat: '36.65131',
    rep_lon: '138.180991',
  },
  {
    pref: '長崎県',
    pref_key: 2,
    lg_code: PrefLgCode.NAGASAKI,
    rep_lat: '32.749601',
    rep_lon: '129.867969',
  },
];

// querySet をテストする
const doStreamTest = async (querySet: QuerySet): Promise<QuerySet> => {
  const reader = Readable.from([querySet], {
    objectMode: true,
  });
  const prefTransform = new PrefTransform({
    prefList,
    logger: undefined,
  });

  const results: QuerySet[] = [];
  await pipeline(
    reader,
    prefTransform,
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
describe('PrefTransform', () => {

  test('should match with prepared data', async () => {
    // クエリを作成
    const querySet = new QuerySet();
    querySet.add(Query.create({
      data: {
        address: "長野県",
        searchTarget: SearchTarget.ALL,
        fuzzy: undefined,
        tag: undefined,
      },
      taskId: 0,
    }));

    // テストを行う
    const results = await doStreamTest(querySet);
    const queries = Array.from(results.values());
    expect(queries.length).toBe(1);

    // query.input.address=「長野県」に対して、trie treeの「長野県」がヒットした
    expect(queries[0].toJSON()).toMatchObject({
      ambiguousCnt: 0,
      pref_key: 1,
      matchedCnt: 3,
      pref: '長野県',
      match_level: MatchLevel.PREFECTURE,
      coordinate_level: MatchLevel.PREFECTURE,
      rep_lat: '36.65131',
      rep_lon: '138.180991',
      lg_code: PrefLgCode.NAGANO,
    });
  });

  test('should match even if "県" is missing', async () => {
    // クエリを作成
    const querySet = new QuerySet();
    querySet.add(Query.create({
      data: {
        address: "長崎",
        searchTarget: SearchTarget.ALL,
        fuzzy: undefined,
        tag: undefined,
      },
      taskId: 0,
    }));

    // テストを行う
    const results = await doStreamTest(querySet);
    const queries = Array.from(results.values());
    expect(queries.length).toBe(2);

    expect(queries).toEqual(expect.arrayContaining([
      // 「長崎」+「県」にマッチした
      expect.objectContaining({
        ambiguousCnt: 1, // 1文字不明瞭
        pref_key: 2,
        matchedCnt: 3,
        pref: '長崎県',
        match_level: MatchLevel.PREFECTURE,
        coordinate_level: MatchLevel.PREFECTURE,
        lg_code: PrefLgCode.NAGASAKI,
      }),

      // 「長崎」+「県」が間違えている可能性もあるので、
      // マッチしていないケースも含まれている
      expect.objectContaining({
        ambiguousCnt: 0, 
        matchedCnt: 0,
        match_level: MatchLevel.UNKNOWN,
        coordinate_level: MatchLevel.UNKNOWN,
      }),
    ]));
  });

  test('should match with the query includes fuzzy character', async () => {
    // クエリを作成
    const querySet = new QuerySet();
    querySet.add(Query.create({
      data: {
        address: `長${DEFAULT_FUZZY_CHAR}県`,
        searchTarget: SearchTarget.ALL,
        fuzzy: DEFAULT_FUZZY_CHAR,
        tag: undefined,
      },
      taskId: 0,
    }));

    // テストを行う
    const results = await doStreamTest(querySet);
    const queries = Array.from(results.values());
    expect(queries.length).toBe(3);

    // query.input.address=「長(DEFAULT_FUZZY_CHAR)県」に対して、trie treeの「長野県」がヒットした
    expect(queries).toEqual(expect.arrayContaining([
      // 「長崎県」にマッチした
      expect.objectContaining({
        ambiguousCnt: 1, // 1文字不明瞭
        pref_key: 2,
        matchedCnt: 3,
        pref: '長崎県',
        match_level: MatchLevel.PREFECTURE,
        lg_code: PrefLgCode.NAGASAKI,
      }),

      // 「長野県」にマッチした
      expect.objectContaining({
        ambiguousCnt: 1, // 1文字不明瞭
        pref_key: 1,
        matchedCnt: 3,
        pref: '長野県',
        match_level: MatchLevel.PREFECTURE,
        lg_code: PrefLgCode.NAGANO,
      }),

      // 「長野県」「長崎県」が間違えている可能性もあるので、
      // マッチしていないケースも含まれている
      expect.objectContaining({
        ambiguousCnt: 0, 
        matchedCnt: 0,
        match_level: MatchLevel.UNKNOWN,
        coordinate_level: MatchLevel.UNKNOWN,
      }),
    ]));
  });
});
