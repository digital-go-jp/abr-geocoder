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
import { MatchLevel } from './match-level';

export enum GeocodeResultFields {
  INPUT = 'input',
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

export class GeocodeResult {
  constructor(
    public readonly input: string,
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
}
