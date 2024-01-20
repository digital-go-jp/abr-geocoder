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
import { DASH_SYMBOLS, SPACE_SYMBOLS } from '@settings/constant-values';
import { MatchLevel } from './match-level';
import { RegExpEx } from './reg-exp-ex';
import { zen2HankakuNum } from './zen2hankaku-num';

export enum GeocodeResultFields {
  INPUT = 'input',
  OUTPUT = 'output',
  MATCH_LEVEL = 'match_level',
  LATITUDE = 'lat',
  LONGITUDE = 'lon',
  OTHER = 'other',
  PREFECTURE = 'prefecture',
  CITY = 'city',
  TOWN = 'town',
  TOWN_ID = 'town_id',
  LG_CODE = 'lg_code',
  BLOCK = 'block',
  BLOCK_ID = 'block_id',
  ADDR1 = 'addr1',
  ADDR1_ID = 'addr1_id',
  ADDR2 = 'addr2',
  ADDR2_ID = 'addr2_id',
}

export interface IGeocodeResult {
  input: string;
  output: string;
  match_level: MatchLevel;
  lat: number | null;
  lon: number | null;
  other: string;
  prefecture?: string;
  city?: string;
  town?: string;
  town_id?: string;
  lg_code?: string;
  block?: string;
  block_id?: string;
  addr1?: string;
  addr1_id?: string;
  addr2?: string;
  addr2_id?: string;
}

export class GeocodeResult implements IGeocodeResult {
  private constructor(
    public readonly input: string,
    public readonly output: string,
    public readonly match_level: MatchLevel,
    public readonly lat: number | null,
    public readonly lon: number | null,
    public readonly other: string,
    public readonly prefecture?: string,
    public readonly city?: string,
    public readonly town?: string,
    public readonly town_id?: string,
    public readonly lg_code?: string,
    public readonly block?: string,
    public readonly block_id?: string,
    public readonly addr1?: string,
    public readonly addr1_id?: string,
    public readonly addr2?: string,
    public readonly addr2_id?: string
  ) {
    Object.freeze(this);
  }

  toJSON(): IGeocodeResult {
    return {
      input: this.input,
      output: this.output,
      match_level: this.match_level,
      lat: this.lat,
      lon: this.lon,
      other: this.other,
      prefecture: this.prefecture,
      city: this.city,
      town: this.town,
      town_id: this.town_id,
      lg_code: this.lg_code,
      block: this.block,
      block_id: this.block_id,
      addr1: this.addr1,
      addr1_id: this.addr1_id,
      addr2: this.addr2,
      addr2_id: this.addr2_id,
    };
  }

  static readonly create = (params: {
    input: string;
    match_level: MatchLevel;
    lat: number | null;
    lon: number | null;
    other: string;
    prefecture?: string;
    city?: string;
    town?: string;
    town_id?: string;
    lg_code?: string;
    block?: string;
    block_id?: string;
    addr1?: string;
    addr1_id?: string;
    addr2?: string;
    addr2_id?: string;
  }): GeocodeResult => {
    //
    // outputを生成する
    //
    const output: string[] = [];
    if (params.prefecture) {
      output.push(params.prefecture);
    }
    if (params.city) {
      output.push(params.city);
    }
    if (params.town) {
      output.push(params.town);
    }
    if (params.block) {
      output.push(params.block);

      if (params.addr1) {
        output.push('-');
        output.push(params.addr1);

        if (params.addr2) {
          output.push('-');
          output.push(params.addr2);
        }
      }
    } else {
      // 大字・小字を含む住所
      if (params.addr1) {
        output.push(params.addr1);
        if (params.addr2) {
          output.push(params.addr2);
        }
      }
    }
    if (params.other) {
      // otherに残っているのは、ジオコードできなかった部分（番地など）。
      // 与えられたクエリ(params.input) を参照して、other で残っている部分の前に
      // 空白 or ハイフンがあれば挿入する
      const tmp = zen2HankakuNum(params.input)
        .replace(RegExpEx.create(`[${SPACE_SYMBOLS}]+`, 'g'), ' ')
        .replace(RegExpEx.create(`[${DASH_SYMBOLS}]+`, 'g'), '-');
      const other = params.other
        .trim()
        .replace(RegExpEx.create(`[${SPACE_SYMBOLS}]+`, 'g'), ' ')
        .replace(RegExpEx.create(`[${DASH_SYMBOLS}]+`, 'g'), '-');
      const pos = tmp.indexOf(other);
      if (pos > 0 && (tmp[pos - 1] === ' ' || tmp[pos - 1] === '-')) {
        output.push(tmp[pos - 1]);
      }
      output.push(params.other.trim());
    }

    return new GeocodeResult(
      params.input,
      output.join(''),
      params.match_level,
      params.lat,
      params.lon,
      params.other,
      params.prefecture,
      params.city,
      params.town,
      params.town_id,
      params.lg_code,
      params.block,
      params.block_id,
      params.addr1,
      params.addr1_id,
      params.addr2,
      params.addr2_id
    );
  };
}
