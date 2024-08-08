import {test, expect, describe} from '@jest/globals';
import { toHankakuAlphaNum } from '../to-hankaku-alpha-num';


describe('toHankakuAlphaNum', () =>{
    // ケース自体そこまでないのですべて試す
    test('大文字テスト', () => {
        const result = toHankakuAlphaNum('ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ');
        expect(result).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    });
    test('小文字テスト', () => {
        const result = toHankakuAlphaNum('ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ');
        expect(result).toBe('abcdefghijklmnopqrstuvwxyz');
    });
    test('数字テスト', () => {
        const result = toHankakuAlphaNum('１２３４５６７８９０');
        expect(result).toBe('1234567890');
    });
    
});

