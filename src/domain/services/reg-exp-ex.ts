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
/**
 * 正規表現をキャッシュするためのクラス
 * RegExpEx.create() で new RegExp() と同じように使用する
 */
import { LRUCache } from 'lru-cache';

export class RegExpEx {
  private static staticCache = new LRUCache<string, RegExp>({
    max: 300,
  });

  private static getKey(pattern: string, flag: string = ''): string {
    return `${pattern}_${flag}`;
  }

  // 同じ正規表現を何度もコンパイルすることによるパフォーマンスの低下を避けるため、
  // LRUキャッシュを用いて（ちょっとだけ）高速化している
  static create(pattern: string, flag: string = ''): RegExp {
    const patternStr = pattern.toString();
    const key = RegExpEx.getKey(patternStr, flag);
    const result = RegExpEx.staticCache.get(key);
    if (result) {
      return result;
    }

    const instance = new RegExp(patternStr, flag);
    RegExpEx.staticCache.set(key, instance);
    return instance;
  }
}
