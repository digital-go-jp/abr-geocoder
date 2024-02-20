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
import { TransformCallback } from 'node:stream';
import { MatchLevel } from './match-level';
import { PrefectureName } from './prefecture-name';
import { SINGLE_QUOTATION, DOUBLE_QUOTATION } from '@settings/constant-values';

export interface IQuery {
  // ファイルから入力された住所（最後まで変更しない）
  input: string;

  // 作業用の変数
  tempAddress: string;

  prefecture?: PrefectureName;

  city?: string;

  town?: string;

  town_id?: string;

  lg_code?: string;

  lat: number | null;

  lon: number | null;

  block?: string;

  block_id?: string;

  addr1?: string;

  addr1_id?: string;

  addr2?: string;

  addr2_id?: string;

  match_level: MatchLevel;

  next?: TransformCallback;
}

export type QueryParams = IQuery;

export type QueryJson = {
  // 入力された住所（最後まで変更しない）
  input: string;

  // ジオコードされなかった部分
  other: string;

  prefecture?: string;

  city?: string;

  town?: string;

  town_id?: string;

  lg_code?: string;

  lat: number | null;

  lon: number | null;

  block?: string;

  block_id?: string;

  addr1?: string;

  addr1_id?: string;

  addr2?: string;

  addr2_id?: string;

  match_level: number;
};

export class Query implements IQuery {
  public readonly input: string;
  public readonly tempAddress: string;
  public readonly prefecture?: PrefectureName;
  public readonly city?: string;
  public readonly town?: string;
  public readonly town_id?: string;
  public readonly lg_code?: string;
  public readonly lat: number | null;
  public readonly lon: number | null;
  public readonly block?: string;
  public readonly block_id?: string;
  public readonly addr1?: string;
  public readonly addr1_id?: string;
  public readonly addr2?: string;
  public readonly addr2_id?: string;
  public readonly match_level: MatchLevel;
  public readonly next?: TransformCallback;

  private constructor(params: QueryParams) {
    this.input = params.input;
    this.tempAddress = params.tempAddress;
    this.prefecture = params.prefecture;
    this.city = params.city;
    this.town = params.town;
    this.town_id = params.town_id;
    this.lg_code = params.lg_code;
    this.lat = params.lat;
    this.lon = params.lon;
    this.block = params.block;
    this.block_id = params.block_id;
    this.addr1 = params.addr1;
    this.addr1_id = params.addr1_id;
    this.addr2 = params.addr2;
    this.addr2_id = params.addr2_id;
    this.match_level = params.match_level;
    this.next = params.next;
    Object.freeze(this);
  }

  public copy(newValues: Partial<QueryParams>): Query {
    // inputは上書き不可
    return new Query(
      Object.assign(
        {
          prefecture: this.prefecture,
          city: this.city,
          town: this.town,
          town_id: this.town_id,
          lg_code: this.lg_code,
          tempAddress: this.tempAddress,
          lat: this.lat,
          lon: this.lon,
          block: this.block,
          block_id: this.block_id,
          addr1: this.addr1,
          addr1_id: this.addr1_id,
          addr2: this.addr2,
          addr2_id: this.addr2_id,
          match_level: this.match_level,
        },
        newValues,
        {
          input: this.input,
          next: this.next,
        }
      )
    );
  }

  static readonly create = (
    address: string,
    next?: TransformCallback
  ): Query => {
    address = address.trim();

    // 先頭1文字と末尾1文字が同じクォーテーションマークなら、取り除く
    const firstChar = address[0];
    const lastChar = address[address.length - 1];
    if (
      firstChar === lastChar &&
      (firstChar === SINGLE_QUOTATION || firstChar === DOUBLE_QUOTATION)
    ) {
      address = address.substring(1, address.length - 1);
    }

    return new Query({
      input: address,
      tempAddress: address,
      lat: null,
      lon: null,
      match_level: MatchLevel.UNKNOWN,
      next,
    });
  };
}
