/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { describe, expect, test } from '@jest/globals';
import {
  OutputFormat,
  SearchTarget
} from '../../src/index';
import { runGeocoder } from './common';

describe('debug', () => {
  
  test('右京区京北下中町勝山田8番地', async () => {
    const input = '右京区京北下中町勝山田8番地';
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
        "input": "右京区京北下中町勝山田8番地"
      },
      "result": {
        "output": "京都府京都市右京区京北下中町勝山田8",
        "others": [],
        "match_level": "parcel",
        "coordinate_level": "machiaza",
        "lat": 35.197301,
        "lon": 135.645758,
        "lg_code": "261084",
        "machiaza_id": "0214112",
        "rsdt_addr_flg": 0,
        "blk_id": null,
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": "000080000000000",
        "pref": "京都府",
        "county": null,
        "city": "京都市",
        "ward": "右京区",
        "oaza_cho": "京北下中町",
        "chome": null,
        "koaza": "勝山田",
        "blk_num": null,
        "rsdt_num": null,
        "rsdt_num2": null,
        "prc_num1": "8",
        "prc_num2": null,
        "prc_num3": null
      }
    });
  });
  test('西京区御陵大枝山町二丁目1-52', async () => {
    const input = '西京区御陵大枝山町二丁目1-52';
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
        "input": "西京区御陵大枝山町二丁目1-52"
      },
      "result": {
        "output": "京都府京都市西京区御陵大枝山町二丁目1-52",
        "others": [
          "1-52"
        ],
        "match_level": "machiaza_detail",
        "coordinate_level": "machiaza_detail",
        "lat": 34.987045,
        "lon": 135.664234,
        "lg_code": "261114",
        "machiaza_id": "0197002",
        "rsdt_addr_flg": 0,
        "blk_id": null,
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "京都府",
        "county": null,
        "city": "京都市",
        "ward": "西京区",
        "oaza_cho": "御陵大枝山町",
        "chome": "二丁目",
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
  test('南区吉祥院三ノ宮町23', async () => {
    const input = '南区吉祥院三ノ宮町23';
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
        "input": "南区吉祥院三ノ宮町23"
      },
      "result": {
        "output": "京都府京都市南区吉祥院三ノ宮町23",
        "others": [],
        "match_level": "parcel",
        "coordinate_level": "machiaza",
        "lat": 34.97737,
        "lon": 135.728624,
        "lg_code": "261076",
        "machiaza_id": "0113000",
        "rsdt_addr_flg": 0,
        "blk_id": null,
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": "000230000000000",
        "pref": "京都府",
        "county": null,
        "city": "京都市",
        "ward": "南区",
        "oaza_cho": "吉祥院三ノ宮町",
        "chome": null,
        "koaza": null,
        "blk_num": null,
        "rsdt_num": null,
        "rsdt_num2": null,
        "prc_num1": "23",
        "prc_num2": null,
        "prc_num3": null
      }
    });
  });

  test('中央区北２条西２３丁目１－１０', async () => {
    const input = '中央区北２条西２３丁目１－１０';
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
        "input": "中央区北２条西２３丁目１－１０"
      },
      "result": {
        "output": "北海道札幌市中央区北二条西二十三丁目1-10",
        "others": [],
        "match_level": "residential_detail",
        "coordinate_level": "residential_detail",
        "lat": 43.05912271,
        "lon": 141.321158426,
        "lg_code": "011011",
        "machiaza_id": "0018023",
        "rsdt_addr_flg": 1,
        "blk_id": "001",
        "rsdt_id": "010",
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "北海道",
        "county": null,
        "city": "札幌市",
        "ward": "中央区",
        "oaza_cho": "北二条西",
        "chome": "二十三丁目",
        "koaza": null,
        "blk_num": "1",
        "rsdt_num": "10",
        "rsdt_num2": null,
        "prc_num1": null,
        "prc_num2": null,
        "prc_num3": null
      }
    });
  });

  test('南１２西１２ー２-２７', async () => {
    const input = '南１２西１２ー２-２７';
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
        "input": "南１２西１２ー２-２７"
      },
      "result": {
        "output": "北海道札幌市中央区南十二条西十二丁目2-27",
        "others": [],
        "match_level": "residential_detail",
        "coordinate_level": "residential_detail",
        "lat": 43.043456568,
        "lon": 141.339900567,
        "lg_code": "011011",
        "machiaza_id": "0040012",
        "rsdt_addr_flg": 1,
        "blk_id": "002",
        "rsdt_id": "027",
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "北海道",
        "county": null,
        "city": "札幌市",
        "ward": "中央区",
        "oaza_cho": "南十二条西",
        "chome": "十二丁目",
        "koaza": null,
        "blk_num": "2",
        "rsdt_num": "27",
        "rsdt_num2": null,
        "prc_num1": null,
        "prc_num2": null,
        "prc_num3": null
      }
    });
  });

  test('東山区清水五丁目130番地の8', async () => {
    const input = '東山区清水五丁目130番地の8';
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
        "input": "東山区清水五丁目130番地の8"
      },
      "result": {
        "output": "京都府京都市東山区清水五丁目130-8",
        "others": [],
        "match_level": "parcel",
        "coordinate_level": "parcel",
        "lat": 34.996669519,
        "lon": 135.77647907,
        "lg_code": "261050",
        "machiaza_id": "0071005",
        "rsdt_addr_flg": 0,
        "blk_id": null,
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": "001300000800000",
        "pref": "京都府",
        "county": null,
        "city": "京都市",
        "ward": "東山区",
        "oaza_cho": "清水",
        "chome": "五丁目",
        "koaza": null,
        "blk_num": null,
        "rsdt_num": null,
        "rsdt_num2": null,
        "prc_num1": "130",
        "prc_num2": "8",
        "prc_num3": null
      }
    });
  });

  test('三重県名張市つつじが丘北３－４－１７', async () => {
    const input = '三重県名張市つつじが丘北３－４－１７';
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
        "input": "三重県名張市つつじが丘北３－４－１７"
      },
      "result": {
        "output": "三重県名張市つつじが丘北三番町4-17",
        "others": [],
        "match_level": "parcel",
        "coordinate_level": "machiaza",
        "lat": 34.606126,
        "lon": 136.131325,
        "lg_code": "242080",
        "machiaza_id": "0102000",
        "blk_id": null,
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": "000040001700000",
        "pref": "三重県",
        "county": null,
        "city": "名張市",
        "ward": null,
        "rsdt_addr_flg": 0,
        "oaza_cho": "つつじが丘北三番町",
        "chome": null,
        "koaza": null,
        "blk_num": null,
        "rsdt_num": null,
        "rsdt_num2": null,
        "prc_num1": "4",
        "prc_num2": "17",
        "prc_num3": null
      }
    });
  });

  test('上京区塔ノ段薮ノ下町428', async () => {
    const input = '上京区塔ノ段薮ノ下町428';
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
        "input": "上京区塔ノ段薮ノ下町428"
      },
      "result": {
        "output": "京都府京都市上京区塔ノ段薮ノ下町428",
        "others": [
          "塔ノ段薮ノ下町428"
        ],
        "match_level": "city",
        "coordinate_level": "city",
        "lat": 35.02953,
        "lon": 135.756697,
        "lg_code": "261025",
        "machiaza_id": null,
        "blk_id": null,
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "京都府",
        "county": null,
        "city": "京都市",
        "ward": "上京区",
        "oaza_cho": null,
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

  test('右京区嵯峨天龍寺今堀町1番地', async () => {
    const input = '右京区嵯峨天龍寺今堀町1番地';
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
        "input": "右京区嵯峨天龍寺今堀町1番地"
      },
      "result": {
        "output": "京都府京都市右京区嵯峨天龍寺今堀町1",
        "others": [],
        "match_level": "parcel",
        "coordinate_level": "machiaza",
        "lat": 35.016706,
        "lon": 135.68201,
        "lg_code": "261084",
        "machiaza_id": "0346000",
        "rsdt_addr_flg": 0,
        "blk_id": null,
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": "000010000000000",
        "pref": "京都府",
        "county": null,
        "city": "京都市",
        "ward": "右京区",
        "oaza_cho": "嵯峨天龍寺今堀町",
        "chome": null,
        "koaza": null,
        "blk_num": null,
        "rsdt_num": null,
        "rsdt_num2": null,
        "prc_num1": "1",
        "prc_num2": null,
        "prc_num3": null
      }
    });
  });
  
  test('青森県十和田市東二番町１－５１', async () => {
    const input = '青森県十和田市東二番町１－５１';
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
        "input": "青森県十和田市東二番町１－５１"
      },
      "result": {
        "output": "青森県十和田市東二番町1-51",
        "others": [],
        "match_level": "residential_detail",
        "coordinate_level": "residential_detail",
        "lat": 40.617851706,
        "lon": 141.212820108,
        "lg_code": "022063",
        "machiaza_id": "0048000",
        "blk_id": "001",
        "rsdt_id": "051",
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "青森県",
        "county": null,
        "city": "十和田市",
        "ward": null,
        "rsdt_addr_flg": 1,
        "oaza_cho": "東二番町",
        "chome": null,
        "koaza": null,
        "blk_num": "1",
        "rsdt_num": "51",
        "rsdt_num2": null,
        "prc_num1": null,
        "prc_num2": null,
        "prc_num3": null
      }
    });
  });
});
