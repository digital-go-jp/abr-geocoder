import { jest, test, expect, describe } from '@jest/globals';
import { resolveHome } from "../../resolve-home";


describe('resolveHome', () => {
    const yourName = "mikuy";
    test('test1', () => {
        const result = resolveHome('~/Documents/alice.word');
        expect(result).toBe(`C:\\Users\\${yourName}\\Documents\\alice.word`);
    })

    test('test2', () => {
        const result = resolveHome(`C:\\Users\\${yourName}\\Documents\\alice.word`);
        expect(result).toBe(`C:\\Users\\${yourName}\\Documents\\alice.word`);
    })

    test('test3', () => {
        const result = resolveHome('');
        expect(result).toBe('');
    })

    test('test4', () => {
        const result = resolveHome('~/ドキュメント/alice.word');
        expect(result).toBe(`C:\\Users\\${yourName}\\ドキュメント\\alice.word`);
    })

    test('test5', () => {
        const result = resolveHome('test.text');
        expect(result).toBe('test.text');
    })

});
