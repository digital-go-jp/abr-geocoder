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
/**
 * 正規表現をキャッシュするためのクラス
 * RegExpEx.create() で new RegExp() と同じように使用する
 */
export class RegExpEx extends RegExp {
  private constructor(pattern: string, flag: string | undefined) {
    super(pattern, flag);
  }

  private static staticCache = new Map<string, RegExpEx>();

  private static getKey(pattern: string, flag: string = ''): string {
    return `${pattern}_${flag}`;
  }

  static create(pattern: string, flag: string = ''): RegExpEx {
    const patternStr = pattern.toString();
    const key = RegExpEx.getKey(patternStr, flag);
    if (RegExpEx.staticCache.has(key)) {
      return RegExpEx.staticCache.get(key)!;
    }
    const instance = new RegExpEx(patternStr, flag);
    RegExpEx.staticCache.set(key, instance);
    return instance;
  }
}
