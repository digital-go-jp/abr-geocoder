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
import { GeocodeResult } from '@domain/geocode-result';
import { MatchLevel } from '@domain/match-level';
import { describe, expect, it } from '@jest/globals';

describe('GeocodeResult', () => {

  it.concurrent('should be "<prefecture><city><town><block>-<addr1>-<addr2> <other>"', async () => {
    expect(
      GeocodeResult.create({
        input: '<input>    <other>',
        match_level: MatchLevel.UNKNOWN,
        lat: 35.12345,
        lon: 137.12345,
        other: '<other>',
        prefecture: '<prefecture>',
        city: '<city>',
        town: '<town>',
        town_id: '<town_id>',
        lg_code: '<lg_code>',
        block: '<block>',
        block_id: '<block_id>',
        addr1: '<addr1>',
        addr1_id: '<addr1_id>',
        addr2: '<addr2>',
        addr2_id: '<addr2_id>'
      }).toJSON(),
    ).toEqual({
      input: '<input>    <other>',
      output: '<prefecture><city><town><block>-<addr1>-<addr2> <other>',
      match_level: MatchLevel.UNKNOWN,
      lat: 35.12345,
      lon: 137.12345,
      other: '<other>',
      prefecture: '<prefecture>',
      city: '<city>',
      town: '<town>',
      town_id: '<town_id>',
      lg_code: '<lg_code>',
      block: '<block>',
      block_id: '<block_id>',
      addr1: '<addr1>',
      addr1_id: '<addr1_id>',
      addr2: '<addr2>',
      addr2_id: '<addr2_id>'
    });
  });


  it.concurrent('should be "<prefecture><city><town><addr1><addr2> <other>"', async () => {
    expect(
      GeocodeResult.create({
        input: '<input>　　　<other>',
        match_level: MatchLevel.UNKNOWN,
        lat: 35.12345,
        lon: 137.12345,
        other: '<other>',
        prefecture: '<prefecture>',
        city: '<city>',
        town: '<town>',
        town_id: '<town_id>',
        lg_code: '<lg_code>',
        addr1: '<addr1>',
        addr1_id: '<addr1_id>',
        addr2: '<addr2>',
        addr2_id: '<addr2_id>'
      }).toJSON(),
    ).toEqual({
      input: '<input>　　　<other>',
      output: '<prefecture><city><town><addr1><addr2> <other>',
      match_level: MatchLevel.UNKNOWN,
      lat: 35.12345,
      lon: 137.12345,
      other: '<other>',
      prefecture: '<prefecture>',
      city: '<city>',
      town: '<town>',
      town_id: '<town_id>',
      lg_code: '<lg_code>',
      addr1: '<addr1>',
      addr1_id: '<addr1_id>',
      addr2: '<addr2>',
      addr2_id: '<addr2_id>'
    });
  })
});
