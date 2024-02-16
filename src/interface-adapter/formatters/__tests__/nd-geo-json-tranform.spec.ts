/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
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
import { describe, expect, it } from '@jest/globals';
import { Stream } from 'node:stream';
import { NdGeoJsonTransform } from '../nd-geo-json-transform';
import { dummyData } from './dummy-data';
import { MatchLevel } from '@domain/match-level';

describe('NdGeoJsonTransform', () => {
  it('should output rows with expected JSON format()', async () => {
    const transform = NdGeoJsonTransform.create();

    const expectJson: string[] = [];
    expectJson.push(JSON.stringify({
      "type":"Feature",
      "geometry":{
        "type":"Point",
        "coordinates":[139.73495,35.681411]
      },
      "properties":{
        "query":{
          "input":"東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階"
        },
        "result":{
          "output": "東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階",
          "match_level": MatchLevel.RESIDENTIAL_DETAIL,
          "prefecture": "東京都",
          "city": "千代田区",
          "town": "紀尾井町",
          "town_id": "0056000",
          "lg_code": "131016",
          "other": " 東京ガーデンテラス紀尾井町 19階、20階",
          "block": "1",
          "block_id": "001",
          "addr1": "3",
          "addr1_id": "003",
          "addr2": "",
          "addr2_id": ""
        }
      }
    }));
    expectJson.push(JSON.stringify({
      "type":"Feature",
      "geometry":{
        "type":"Point",
        "coordinates":[139.73495,35.681411]
      },
      "properties":{
        "query":{
          "input":"東京都千代田区紀尾井町1"
        },
        "result":{
          "output": "東京都千代田区紀尾井町1",
          "match_level": MatchLevel.RESIDENTIAL_BLOCK,
          "prefecture":"東京都",
          "city":"千代田区",
          "town":"紀尾井町",
          "town_id":"0056000",
          "lg_code":"131016",
          "other":"",
          "block": "1",
          "block_id": "001"
        }
      }
    }));

    expectJson.push(JSON.stringify({
      "type":"Feature",
      "geometry":{
        "type":"Point",
        "coordinates":[140.339126,38.255437]
      },
      "properties":{
        "query":{
          "input":"山形県山形市旅篭町二丁目3番25号"
        },
        "result":{
          "output": "山形県山形市旅篭町二丁目3-25",
          "match_level":MatchLevel.RESIDENTIAL_DETAIL,
          "prefecture":"山形県",
          "city":"山形市",
          "town":"旅篭町二丁目",
          "town_id":"0247002",
          "lg_code":"062014",
          "other":"",
          "block":"3",
          "block_id":"003",
          "addr1":"25",
          "addr1_id":"025",
          "addr2":"",
          "addr2_id":""
        }
      }
    }));

    expectJson.push(JSON.stringify({
      "type":"Feature",
      "geometry":{
        "type":"Point",
        "coordinates":[140.339126,38.255437]
      },
      "properties":{
        "query":{
          "input":"山形市旅篭町二丁目3番25号"
        },
        "result":{
          "output":"山形県山形市旅篭町二丁目3-25",
          "match_level":MatchLevel.RESIDENTIAL_DETAIL,
          "prefecture":"山形県",
          "city":"山形市",
          "town":"旅篭町二丁目",
          "town_id":"0247002",
          "lg_code":"062014",
          "other":"",
          "block":"3",
          "block_id":"003",
          "addr1":"25",
          "addr1_id":"025",
          "addr2":"",
          "addr2_id":""
        }
      }
    }));
    expectJson.push(JSON.stringify({
      "type":"Feature",
      "geometry":{
        "type":"Point",
        "coordinates":[139.440264,35.548247]
      },
      "properties":{
        "query":{
          "input":"東京都町田市森野2-2-22 町田市役所"
        },
        "result":{
          "output": "東京都町田市森野二丁目2-22 町田市役所",
          "match_level":MatchLevel.RESIDENTIAL_DETAIL,
          "prefecture":"東京都",
          "city":"町田市",
          "town":"森野二丁目",
          "town_id":"0006002",
          "lg_code":"132098",
          "other":"町田市役所",
          "block":"2",
          "block_id":"002",
          "addr1":"22",
          "addr1_id":"022",
          "addr2":"",
          "addr2_id":""
        }
      }
    }));

    const buffer: string[] = [];
    const writable = new Stream.Writable({
      objectMode: true,
      write(chunk, encoding, callback) {
        buffer.push(chunk.toString());
        callback();
      },
    })
    const readStream = Stream.Readable.from(dummyData);

    await Stream.promises.pipeline(
      readStream,
      transform,
      writable,
    )
    
    const result = buffer.join('');
    const expects = expectJson.map(line => JSON.parse(line));
    const results = result.trim().split('\n').map(line => JSON.parse(line));

    expect(results).toEqual(expects);
  });
});
