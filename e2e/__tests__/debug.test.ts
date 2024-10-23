import { describe, expect, test } from '@jest/globals';
import {
  OutputFormat,
  SearchTarget
} from '../../src/index';
import { runGeocoder } from './common';


describe('debug', () => {

  test('岩手県八幡平市大更第35地割', async () => {
    const input = '岩手県八幡平市大更第35地割';
    const { stdout } = await runGeocoder({
      input,
      geocode: {
        outputFormat: OutputFormat.NDJSON,
        searchTarget: SearchTarget.ALL,
      },
    });

    expect(JSON.parse(stdout)).toMatchObject({
      "query": {
        "input": "岩手県八幡平市大更第35地割"
      },
      "result": {
        "output": "岩手県八幡平市大更第35地割",
        "others": [],
        "match_level": "machiaza_detail",
        "coordinate_level": "machiaza",
        "lat": 39.911413,
        "lon": 141.125139,
        "lg_code": "032140",
        "machiaza_id": "0034128",
        "rsdt_addr_flg": 0,
        "blk_id": null,
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "岩手県",
        "county": null,
        "city": "八幡平市",
        "ward": null,
        "oaza_cho": "大更",
        "chome": null,
        "koaza": "第35地割",
        "blk_num": null,
        "rsdt_num": null,
        "rsdt_num2": null,
        "prc_num1": null,
        "prc_num2": null,
        "prc_num3": null
      }
    });
  });
});
