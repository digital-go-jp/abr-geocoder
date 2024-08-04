import { test, expect, describe } from '@jest/globals';
import { toHiragana } from "../to-hiragana";

describe('toHiragana', () => {
    test('アイウエオ', () => {
        const result = toHiragana('アイウエオ');
        expect(result).toBe('あいうえお');
    });
    test('色々', () => {
        const result = toHiragana('あ私アイぇえｶウエ');
        expect(result).toBe('あ私あいええかうえ');
    });
    test('数字', () => {
        const result = toHiragana('1あ2ア3');
        expect(result).toBe('1あ2あ3');
    });
})