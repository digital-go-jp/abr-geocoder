import { describe, expect, test } from '@jest/globals';
import {
  OutputFormat,
  SearchTarget
} from '../../src/index';
import { runGeocoder } from './common';


describe('debug', () => {

  test('伏見区久我森の宮町14番地の27', async () => {
    const input = '伏見区久我森の宮町14番地の27';
    const { stdout } = await runGeocoder({
      input,
      geocode: {
        outputFormat: OutputFormat.NDJSON,
        searchTarget: SearchTarget.ALL,
      },
    });

    expect(JSON.parse(stdout)).toMatchObject({
      "query": {
        "input": "伏見区久我森の宮町14番地の27"
      },
      "result": {
        "output": "京都府京都市伏見区久我森の宮町14-27",
        "others": [
          "14-27"
        ],
        "match_level": "machiaza",
        "coordinate_level": "machiaza",
        "lat": 34.937412,
        "lon": 135.727766,
        "lg_code": "261092",
        "machiaza_id": "0076000",
        "rsdt_addr_flg": 0,
        "blk_id": null,
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "京都府",
        "county": null,
        "city": "京都市",
        "ward": "伏見区",
        "oaza_cho": "久我森の宮町",
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
