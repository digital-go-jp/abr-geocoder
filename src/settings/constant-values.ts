/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
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
export const DASH_SYMBOLS: string = [
  '－', // 全角ハイフンマイナス
  '\\-', // 半角ハイフンマイナス
  '−', // 全角マイナス
  '‐', // 全角ハイフン
  '‒', // フィギュアーダッシュ
  '–', // 二分ダッシュ
  '—', // 全角ダッシュ
  '─', // 罫線
  '━', // 罫線（太）
  // '一', // いち
  '―', // ホリゾンタルバー
  'ー', // 全角長音
  'ｰ', // 半角長音
  '⏤',
  '⎯',
  '﹘',
  '‑',
  '⁃',
  '﹣',
].join('');
export const NUMRIC_SYMBOLS: string = ['0-9', '０-９'].join('');

export const KANJI_1to10_SYMBOLS: string = ['一二三四五六七八九〇十'].join('');
export const NUMRIC_AND_KANJI_SYMBOLS: string = [
  '0-9',
  '０-９',
  '一二三四五六七八九〇十百千',
].join('');
export const ALPHA_NUMERIC_SYMBOLS: string = ['０-９Ａ-Ｚａ-ｚ'].join('');

export const J_DASH: string = 'の|之|ノ|丿';

// 半角スペースに置き換えると
// 問題を起こしやすいので、別の文字に置き換える
// 基本的に住所には含まれていなはず
export const SPACE: string = '␣';

// 全角ハイフンを半角ハイフンに置き換えると、
// 正規表現の範囲を示すために用いる半角ハイフンと被ってしまい
// 問題を起こしやすいので、別の文字に置き換える
// 基本的に住所には含まれていなはず
export const DASH: string = '@';

export const SPACE_SYMBOLS: string = [
  ' ', // 半角スペース
  '　', // 全角スペース
].join('');

// ワイルドカードとしてマッチングさせる1文字
export const DEFAULT_FUZZY_CHAR: string = '?';

// yargs が '-' を解析できないので、別の文字に置き換える
export const SINGLE_DASH_ALTERNATIVE: string = '<stdin>';

// 出力の最後に改行を追加するためのマーク
export const BREAK_AT_EOF = '\n';

export const SINGLE_QUOTATION = `'`;
export const DOUBLE_QUOTATION = `"`;
