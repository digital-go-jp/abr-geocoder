import { describe, expect, test } from '@jest/globals';
import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { TrimTransform } from '../trim-transform';


describe('TrimTransform', () => {

  test('should remove the double quotation marks at the head and the tail.', async () => {
    const reader = Readable.from([
      // 最初と最後にダブルクオーテーションがある場合
      '"北海道札幌市西区二十四軒４条２丁目６－１７"',
      '"北海道札幌市北区北１６西２－１－１"',
    ], {
      objectMode: true,
    });
    const filter = new TrimTransform();
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
    const filter = new TrimTransform();
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
