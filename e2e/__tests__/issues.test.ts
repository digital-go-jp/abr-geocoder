import { describe, test } from '@jest/globals';
import { jsonTestRunner } from './common';

describe('issues', () => {
  test('#131: ハイフンのゆらぎ', async () => {
    await jsonTestRunner('issue131');
  });

  test('#133: 「地割」が「koaza」に正規化されない', async () => {
    await jsonTestRunner('issue133');
  });

  test('#122: 大字・町なし小字ありのパターンでマッチングできない', async () => {
    await jsonTestRunner('issue122');
  });
  
  test('#123: 同一市区町村のある町字が別の町字に前方一致するパターン', async () => {
    await jsonTestRunner('issue123');
  });

  test('#157: エッジケース：階数を含むケース', async () => {
    await jsonTestRunner('issue157');
  });
  test('#166: 半角カタカナの「ｹ」がマッチしない', async () => {
    await jsonTestRunner('issue166');
  });
});
