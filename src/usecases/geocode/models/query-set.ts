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
import { Query } from './query';
import stringHash from 'string-hash';

export class QuerySet {

  private memory: Map<number, Query> = new Map();

  static toKey(query: Query) {
    const values: (string | number | undefined)[] = [
      query.pref_key,
      query.city_key,
      query.town_key,
      query.parcel_key,
      query.rsdtblk_key,
      query.rsdtdsp_key,
      query.tempAddress?.toProcessedString(),
    ];
    const keyStr = values
      .filter(x => x !== undefined)
      .map(x => x.toString())
      .join(':');
    return stringHash(keyStr);
  }
  add(query: Query) {
    const key = QuerySet.toKey(query);
    if (this.memory.has(key)) {
      return;
    }
    this.memory.set(key, query);
  }

  values(): Iterable<Query> {
    return this.memory.values();
  }

  delete(query: Query) {
    const key = QuerySet.toKey(query);
    if (!this.memory.has(key)) {
      return;
    }
    return this.memory.delete(key);
  }

  clear() {
    this.memory.clear();
  }
  
}