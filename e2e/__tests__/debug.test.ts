import { describe, expect, test } from '@jest/globals';
import {
  OutputFormat,
  SearchTarget
} from '../../src/index';
import { runGeocoder } from './common';


describe('debug', () => {

  test('山科区音羽森廻リ町32', async () => {
    const input = '山科区音羽森廻リ町32';
    const { stdout } = await runGeocoder({
      input,
      geocode: {
        outputFormat: OutputFormat.NDJSON,
        searchTarget: SearchTarget.ALL,
      },
    });

    expect(JSON.parse(stdout)).toMatchObject({
      "query": {
        "input": "山科区音羽森廻リ町32"
      },
      "result": {
        "output": "京都府京都市山科区音羽森廻り町32",
        "others": [
          "32"
        ],
        "match_level": "machiaza",
        "coordinate_level": "machiaza",
        "lat": 34.985641,
        "lon": 135.823916,
        "lg_code": "261106",
        "machiaza_id": "0076000",
        "rsdt_addr_flg": 0,
        "blk_id": null,
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "京都府",
        "county": null,
        "city": "京都市",
        "ward": "山科区",
        "oaza_cho": "音羽森廻り町",
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
