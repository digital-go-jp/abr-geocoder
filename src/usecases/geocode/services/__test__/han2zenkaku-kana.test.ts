import { test, expect, describe } from '@jest/globals';
import { han2ZenkakuKana } from '../han2zenkaku-kana';


describe('han2ZenkakuKana', () => {
    test('test1', () => {
        const result = han2ZenkakuKana('ﾃﾞｼﾞﾀﾙ庁');
        expect(result).toBe('テﾞシﾞタル庁');
    })

    test('test2', () => {
        const result = han2ZenkakuKana('ﾃﾞｼﾞ庁');
        expect(result).toBe('テﾞシﾞ庁');
    })

    test('test3', () => {
        const result = han2ZenkakuKana('ｸﾟけ゚ｳﾞ ｶﾞ ｷﾞ ｸﾞ ｹﾞ ｺﾞｱ　ｲ ｳ');
        expect(result).toBe('クﾟけ゚ウﾞ カﾞ キﾞ クﾞ ケﾞ コﾞア　イ ウ');
    })

    test('test4', () => {
        const result = han2ZenkakuKana('ab c');
        expect(result).toBe('ab c');
    })

});
