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
import { LRUCache } from "lru-cache";
import stringHash from "string-hash";

export class TableKeyProvider {
  private static readonly cache = new LRUCache<string, string>({
    max: 300,
  });

  private static generateKey = (key: string): string => {
    let result = this.cache.get(key);
    if (result) {
      return result;
    }
    result = stringHash(key).toFixed(16);
    this.cache.set(key, result);
    return result;
  };

  static readonly getPrefKey = (params: Required<{
    lg_code: string;
  }>): string => {
    const prefix = params.lg_code.substring(0, 2);
    return this.generateKey(prefix);
  };

  static getCityKey(params: Required<{
    lg_code: string;
  }>): string {
    const key = params.lg_code;
    return this.generateKey(key);
  }

  static readonly getTownKey = (params: Required<{
    lg_code: string;
    machiaza_id: string;
  }>): string => {
    const key = [
      params.lg_code,
      params.machiaza_id,
    ].join('/');

    return this.generateKey(key);
  };

  static readonly getRsdtBlkKey = (params: Required<{
    lg_code: string;
    machiaza_id: string;
    blk_id: string;
  }>): string => {
    const key = [
      params.lg_code,
      params.machiaza_id,
      params.blk_id,
    ].join('/');
    return this.generateKey(key);
  };


  static readonly getRsdtDspKey = (params: {
    lg_code: string;
    machiaza_id: string;
    blk_id: string;
    rsdt_id: string;
    rsdt2_id: string;
    rsdt_addr_flg: number;
  }): string => {
    const key = [
      params.lg_code,
      params.machiaza_id,
      params.blk_id,
      params.rsdt_id,
      params.rsdt2_id,
      params.rsdt_addr_flg.toString(),
    ].join('/');

    return this.generateKey(key);
  };

  static readonly getParcelKey = (params: {
    lg_code: string;
    machiaza_id?: string | null;
    prc_id: string;
  }): string => {
    const key = [
      params.lg_code,
      params.machiaza_id,
      params.prc_id,
    ]
      .filter(x => x !== null && x !== '')
      .join('/');

    return this.generateKey(key);
  };
}
