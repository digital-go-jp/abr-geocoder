import { describe, expect, test } from '@jest/globals';
import {
  OutputFormat,
  SearchTarget
} from '../../src/index';
import { runGeocoder } from './common';


describe('debug', () => {

  test('北海道釧路市豊川８－１９', async () => {
    const input = '北海道釧路市豊川８－１９';
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
        "input": "北海道釧路市豊川８－１９"
      },
      "result": {
        "output": "北海道釧路市豊川町8-19",
        "others": [],
        "match_level": "residential_detail",
        "coordinate_level": "residential_detail",
        "lat": 43.009050373,
        "lon": 144.376992784,
        "lg_code": "012068",
        "machiaza_id": "0292000",
        "blk_id": "008",
        "rsdt_id": "019",
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "北海道",
        "county": null,
        "city": "釧路市",
        "ward": null,
        "oaza_cho": "豊川町",
        "chome": null,
        "koaza": null,
        "blk_num": "8",
        "rsdt_addr_flg": 1,
        "rsdt_num": "19",
        "rsdt_num2": null,
        "prc_num1": null,
        "prc_num2": null,
        "prc_num3": null
      }
    });
  });
});
