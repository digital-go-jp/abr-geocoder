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
  
  test('千葉県山武郡横芝光町横芝字真砂４８２番地の２', async () => {
    const input = '千葉県山武郡横芝光町横芝字真砂４８２番地の２';
    const { stdout } = await runGeocoder({
      input,
      geocode: {
        outputFormat: OutputFormat.NDJSON,
        searchTarget: SearchTarget.ALL,
      },
      useGlobalDB: false,
    });

    expect(JSON.parse(stdout)).toMatchObject({
      "query": {
        "input": "千葉県山武郡横芝光町横芝字真砂４８２番地の２"
      },
      "result": {
        "output": "千葉県山武郡横芝光町横芝真砂482-2",
        "others": [
          "真砂482-2"
        ],
        "match_level": "machiaza",
        "coordinate_level": "machiaza",
        "lat": 35.66006,
        "lon": 140.487422,
        "lg_code": "124109",
        "machiaza_id": "0049000",
        "rsdt_addr_flg": 0,
        "blk_id": null,
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "千葉県",
        "county": "山武郡",
        "city": "横芝光町",
        "ward": null,
        "oaza_cho": "横芝",
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
  test('北海道札幌市白石区流通センター五丁目6-61', async () => {
    const input = '北海道札幌市白石区流通センター五丁目6-61';
    const { stdout } = await runGeocoder({
      input,
      geocode: {
        outputFormat: OutputFormat.NDJSON,
        searchTarget: SearchTarget.ALL,
      },
      useGlobalDB: false,
    });

    expect(JSON.parse(stdout)).toMatchObject({
      "query": {
        "input": "北海道札幌市白石区流通センター五丁目6-61"
      },
      "result": {
        "output": "北海道札幌市白石区流通センター五丁目6-61",
        "others": [],
        "score": 1,
        "match_level": "residential_detail",
        "coordinate_level": "residential_detail",
        "lat": 43.032202568,
        "lon": 141.44805378,
        "lg_code": "011045",
        "machiaza_id": "0207005",
        "rsdt_addr_flg": 1,
        "blk_id": "006",
        "rsdt_id": "061",
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "北海道",
        "county": null,
        "city": "札幌市",
        "ward": "白石区",
        "oaza_cho": "流通センター",
        "chome": "五丁目",
        "koaza": null,
        "blk_num": "6",
        "rsdt_num": "61",
        "rsdt_num2": null,
        "prc_num1": null,
        "prc_num2": null,
        "prc_num3": null
      }
    });
  });
});
