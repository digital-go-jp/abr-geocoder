import { DASH } from "@config/constant-values";
import { SearchTarget } from "@domain/types/search-target";
import { describe, expect, test } from "@jest/globals";
import { QueryInput } from "@usecases/geocode/models/query";
import { QuerySet } from "@usecases/geocode/models/query-set";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NormalizeTransform } from "../normalize-transform";

// querySet をテストする
const doStreamTest = async (queryInput: QueryInput): Promise<QuerySet> => {
  const reader = Readable.from([queryInput], {
    objectMode: true,
  });
  const normalizeTransform = new NormalizeTransform({
    logger: undefined,
  });

  const results: QuerySet[] = [];
  await pipeline(
    reader,
    normalizeTransform,
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
describe('NormalizeTransform', () => {

  test('should convert (number)+(漢数字の一)+(number) to (number)+(DASH)+(number)', async () => {
    // クエリを作成
    const queryInput = {
      data: {
        address: "どこか1一3",
        searchTarget: SearchTarget.ALL,
        fuzzy: undefined,
        tag: undefined,
      },
      lineId: 0,
      taskId: 0,
    };

    // テストを行う
    const results = await doStreamTest(queryInput);
    const queries = Array.from(results.values());
    expect(queries.length).toBe(1);

    const processedStr = queries[0].tempAddress?.toProcessedString();
    expect(processedStr).toBe(`どこか1${DASH}3`);
  });

});
