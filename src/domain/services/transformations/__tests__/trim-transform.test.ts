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
import { describe, expect, test } from '@jest/globals';
import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { CommentFilterTransform } from '../comment-filter-transform';

describe('TrimTransform', () => {

  test('should remove the double quotation marks at the head and the tail.', async () => {
    const reader = Readable.from([
      // 最初と最後にダブルクオーテーションがある場合
      '"北海道札幌市西区二十四軒４条２丁目６－１７"',
      '"北海道札幌市北区北１６西２－１－１"',
    ], {
      objectMode: true,
    });
    const filter = new CommentFilterTransform();
    const buffer: string[] = [];
    const dst = new Writable({
      objectMode: true,
      write(chunk, _encoding, callback) {
        buffer.push(chunk);
        callback();
      },
    });

    await pipeline(
      reader,
      filter,
      dst,
    );

    expect(buffer).toEqual([
      "北海道札幌市西区二十四軒４条２丁目６－１７",
      "北海道札幌市北区北１６西２－１－１",
    ]);
  });
  test('should remove the comments in the lines.', async () => {
    const reader = Readable.from([
      // 最初と最後にダブルクオーテーションがある場合
      '// 北海道札幌市西区二十四軒４条２丁目６－１７',
      '北海道札幌市北区北１６西２－１－１',
      '北海道札幌市北区北１６西２－１－１ // 重複',
      '北海道札幌市北区北１６西２－１－１ /* 重複 */',
      '北海道札幌市北区北１６/*テスト*/西２－１－１ /* 重複 */',
    ], {
      objectMode: true,
    });
    const filter = new CommentFilterTransform();
    const buffer: string[] = [];
    const dst = new Writable({
      objectMode: true,
      write(chunk, _encoding, callback) {
        buffer.push(chunk);
        callback();
      },
    });

    await pipeline(
      reader,
      filter,
      dst,
    );

    expect(buffer).toEqual([
      "北海道札幌市北区北１６西２－１－１",
      "北海道札幌市北区北１６西２－１－１",
      "北海道札幌市北区北１６西２－１－１",
      "北海道札幌市北区北１６西２－１－１",
    ]);
  });
});
