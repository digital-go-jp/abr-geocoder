import {test, expect, describe} from '@jest/globals';
import { toHiragana } from '../to-hiragana';

describe('toHiragana', () =>{

  test('test1', () => {
    const result = toHiragana('アイウエオ');
    expect(result).toBe('あいうえお');
  });

  test('test2', () => {
    // カとケ　は「け」に変換する (龍ヵ崎市 → 龍ケ崎市)
    const result = toHiragana('カキクケコ');
    expect(result).toBe('けきくけこ');
  });
});
