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
import { RegExpEx } from '../reg-exp-ex';

describe('RegExpEx', () => {
  it.concurrent('should be the same', async () => {
    const target1 = /[a-zA-Z]/g;
    const target2 = RegExpEx.create('[a-zA-Z]', 'g');
    expect(target2).toEqual(target1);
  });

  it.concurrent('should return the same instance for the same pattern', async () => {
    const regExp1 = RegExpEx.create('[a-zA-Z]', 'g');
    const regExp2 = RegExpEx.create('[a-zA-Z]', 'g');
    expect(regExp1).toBe(regExp2);

    const regExp3 = RegExpEx.create('[A-Za-z]', 'g');
    const regExp4 = RegExpEx.create('[A-Za-z]', 'g');
    expect(regExp3).toBe(regExp4);

    const regExp5 = RegExpEx.create('[a-zA-Z]', 'g');
    expect(regExp5).toBe(regExp2);
  });
});
