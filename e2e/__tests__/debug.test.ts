import { describe, expect, test } from '@jest/globals';
import {
  OutputFormat,
  SearchTarget
} from '../../src/index';
import { runGeocoder, jsonTestRunner, readJsonFile, testRunner } from './common';


describe.skip('debug', () => {

  test('茨城県龍ｹ崎市久保台2-3 久保台小学校', async () => {
    const input = '茨城県龍ｹ崎市久保台2-3 久保台小学校';
    const { stdout } = await runGeocoder({
      input,
      geocode: {
        outputFormat: OutputFormat.NDJSON,
        searchTarget: SearchTarget.ALL,
      },
    });

    expect(JSON.parse(stdout)).toMatchObject({
      "query": {
        "input": "茨城県龍ｹ崎市久保台2-3 久保台小学校"
      },
      "result": {
        "output": "茨城県龍ケ崎市久保台二丁目3 久保台小学校",
        "others": ["久保台小学校"],
        "match_level": "residential_block",
        "coordinate_level": "residential_block",
        "lat": 35.933121,
        "lon": 140.177146,
        "lg_code": "082082",
        "machiaza_id": "0017002",
        "rsdt_addr_flg": 1,
        "blk_id": "003",
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "茨城県",
        "county": null,
        "city": "龍ケ崎市",
        "ward": null,
        "oaza_cho": "久保台",
        "chome": "二丁目",
        "koaza": null,
        "blk_num": "3",
        "rsdt_num": null,
        "rsdt_num2": null,
        "prc_num1": null,
        "prc_num2": null,
        "prc_num3": null
      }
    });
  });
});


describe('issues', () => {
  test('#131: ハイフンのゆらぎ', async () => {
    await jsonTestRunner('issue131');
  });

  test('#133: 「地割」が「koaza」に正規化されない', async () => {
    await jsonTestRunner('issue133');
  });

  test('#122: 大字・町なし小字ありのパターンでマッチングできない', async () => {
    await jsonTestRunner('issue122');
  });
  
  test('#123: 同一市区町村のある町字が別の町字に前方一致するパターン', async () => {
    await jsonTestRunner('issue123');
  });

  test('#157: エッジケース：階数を含むケース', async () => {
    await jsonTestRunner('issue157');
  });
  test('#166: 半角カタカナの「ｹ」がマッチしない', async () => {
    await jsonTestRunner('issue166');
  });
});
