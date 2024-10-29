import { describe, expect, test, jest } from '@jest/globals';
import {
  OutputFormat,
  SearchTarget
} from '../../src/index';
import { runGeocoder } from './common';


describe.skip('debug', () => {

  test('北海道石狩郡新篠津村第46線北10', async () => {
    const input = '北海道石狩郡新篠津村第４６線北１０番地';
    const { stdout } = await runGeocoder({
      input,
      geocode: {
        outputFormat: OutputFormat.NDJSON,
        searchTarget: SearchTarget.ALL,
      },
      useGlobalDB: true,
    });

    expect(JSON.parse(stdout)).toMatchObject({
      "query": {
        "input": "北海道石狩郡新篠津村第４６線北１０番地"
      },
      "result": {
        "output": "北海道石狩郡新篠津村第四十六線北10",
        "others": [
          "10"
        ],
        "match_level": "machiaza",
        "coordinate_level": "machiaza",
        "lat": 43.24806,
        "lon": 141.641829,
        "lg_code": "013048",
        "machiaza_id": "0024000",
        "blk_id": null,
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "北海道",
        "county": "石狩郡",
        "city": "新篠津村",
        "ward": null,
        "oaza_cho": "第四十六線北",
        "chome": null,
        "koaza": null,
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
