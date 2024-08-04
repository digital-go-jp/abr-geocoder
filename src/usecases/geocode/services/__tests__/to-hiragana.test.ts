import { test, expect, describe } from '@jest/globals';
import { toHiragana } from '../to-hiragana';

describe('toHiragana', () => {
  test('test1', () => {
    const result = toHiragana('アイウエオ');
    expect(result).toBe('あいうえお');
  });
  test('test2', () => {
    const result = toHiragana('あいう漢字ﾊﾝｶｸえお');
    expect(result).toBe('あいう漢字はんかくえお');
  });

  test('test3', () => {
    const result = toHiragana('123あゝあアあ');
    expect(result).toBe('123あゝあああ');
  });
});