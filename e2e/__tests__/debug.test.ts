import { describe, expect, test } from '@jest/globals';
import {
  OutputFormat,
  SearchTarget
} from '../../src/index';
import { runGeocoder } from './common';


describe('debug', () => {

  test('東京都港区芝浦3-1-1 # all:住居表示, rsdt:住居表示, parcel:地番', async () => {
    const input = '東京都港区芝浦3-1-1 # all:住居表示, rsdt:住居表示, parcel:地番';
    const { stdout } = await runGeocoder({
      input,
      geocode: {
        outputFormat: OutputFormat.NDJSON,
        searchTarget: SearchTarget.ALL,
      },
    });

    expect(JSON.parse(stdout)).toMatchObject({
      "query": {
        "input": "東京都港区芝浦3-1-1 # all:住居表示, rsdt:住居表示, parcel:地番"
      },
      "result": {
        "output": "東京都港区芝浦三丁目1-1 # all:住居表示, rsdt:住居表示, parcel:地番",
        "others": [
          "-1 # all:住居表示, rsdt:住居表示, parcel:地番"
        ],
        "score": 0.94,
        "match_level": "residential_block",
        "coordinate_level": "residential_block",
        "lat": 35.644986,
        "lon": 139.748888,
        "lg_code": "131032",
        "machiaza_id": "0005003",
        "rsdt_addr_flg": 1,
        "blk_id": "001",
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "東京都",
        "county": null,
        "city": "港区",
        "ward": null,
        "oaza_cho": "芝浦",
        "chome": "三丁目",
        "koaza": null,
        "blk_num": "1",
        "rsdt_num": null,
        "rsdt_num2": null,
        "prc_num1": null,
        "prc_num2": null,
        "prc_num3": null
      }
    });
  });
});
