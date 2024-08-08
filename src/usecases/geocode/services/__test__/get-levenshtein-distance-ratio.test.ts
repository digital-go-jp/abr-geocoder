import {test, expect, describe} from '@jest/globals';
import { getLevenshteinDistanceRatio } from '../get-levenshtein-distance-ratio';


describe('getLevenshteinDistanceRatio', () =>{
    // レーベンシュタイン距離計測のテスト
    // コメントでは1.0 に近いほど strA と strB は類似度が高いとあったが、
    // 実際は０に近いほうが類似度が高いと考えられる。
    // ベースケース１
    test('test1', () => {
        const result = getLevenshteinDistanceRatio('神戸市兵庫区','');
        // 改変(削除)コスト7, 文字列7
        expect(result).toBe(6 / 6);
    });

    // ベースケース２
    test('test2', () => {
        // 改変(挿入)コスト7, 文字列7
        const result = getLevenshteinDistanceRatio('','東京都千代田区');
        expect(result).toBe(7 / 7);
    });

    // 差し替えケース
    test('test3', () => {
        // 改変コスト1, 文字列6
        const result = getLevenshteinDistanceRatio('沖縄県那覇市','沖縄都那覇市');
        expect(result).toBe(1 / 6);
    });

    // 挿入ケース
    test('test4', () => {
        // 改変コスト1, 文字列3
        const result = getLevenshteinDistanceRatio('鳥県','鳥取県');
        expect(result).toBe(1 / 3);
    });

    // 削除ケース
    test('test5', () => {
        // 改変コスト2, 文字列6
        const result = getLevenshteinDistanceRatio('千代田区','一千万代田区');
        expect(result).toBe(2 / 6);
    });

    // 全部含んだケース
    test('test6', () => {
        // 改変コスト5, 文字列7
        const result = getLevenshteinDistanceRatio('東京都区都市町','山町京都市町府');
        expect(result).toBe(5 / 7);
    });

});