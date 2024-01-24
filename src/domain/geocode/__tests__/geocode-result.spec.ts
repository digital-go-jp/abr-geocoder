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
import { describe, expect, it, jest } from '@jest/globals';
import { toRegexPattern } from '../to-regex-pattern';
import { GeocodeResult } from '@domain/geocode-result';
import { MatchLevel } from '@domain/match-level';
import { PrefectureName } from '@domain/prefecture-name';

describe('GeocodeResult', () => {
  it.concurrent('cases for "宮城県登米市迫町佐沼字中江1-1-7"', async () => {
    const target = GeocodeResult.create({
      input: '宮城県登米市迫町佐沼字中江1-1-7',
      match_level: MatchLevel.RESIDENTIAL_BLOCK,
      prefecture: PrefectureName.MIYAGI,
      city: '登米市',
      town: '迫町佐沼字中江１丁目',
      town_id: '0318146',
      lg_code: '042129',
      lat: 38.693339,
      lon: 141.192838,
      block: '1',
      block_id: '001',
      other: '7',
    })

    expect(target.toJSON()).toEqual({
      output: '宮城県登米市迫町佐沼字中江１丁目1-7',
      input: '宮城県登米市迫町佐沼字中江1-1-7',
      match_level: MatchLevel.RESIDENTIAL_BLOCK,
      prefecture: PrefectureName.MIYAGI,
      city: '登米市',
      town: '迫町佐沼字中江１丁目',
      town_id: '0318146',
      lg_code: '042129',
      lat: 38.693339,
      lon: 141.192838,
      block: '1',
      block_id: '001',
      other: '7',
      addr1: undefined,
      addr1_id: undefined,
      addr2: undefined,
      addr2_id: undefined,
    })
  });

})