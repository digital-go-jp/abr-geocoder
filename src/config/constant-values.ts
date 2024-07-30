/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
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

export const ZENKAKU: string = '[^\x01-\x7E\xA1-\xDF]'

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


// 東京都青ヶ島村無番地 のように「無番地」の部分は、「無番地」で当たるべきである。
// 「番地」が含まれているため、上手く処理できないので
// 別の文字列に置き換える
export const MUBANCHI: string = '<MUBANCHI>';

// 岡山市北区 と 香川県高松市に、「番町1丁目」があり、
//「番町」を DASH に置換すると正しく処理ができないので、
// 別の文字列に置き換える
export const OAZA_BANCHO: string = '<OAZA_BANCHO>';

// 半角数字と漢数字が連続する（例：〇〇町1-2-3三田マンション）と
// 検索に失敗してしまうので、仮想の空白を挿入する。
// 基本的に住所には含まれていなはず
export const VIRTUAL_SPACE: string = '<';

export const SPACE_CHARS: string = [
  ' ', // 半角スペース
  '　', // 全角スペース
].join('');

export const SPACE_SYMBOLS: string = [
  SPACE,
  VIRTUAL_SPACE,
].join('');

// ワイルドカードとしてマッチングさせる1文字
export const DEFAULT_FUZZY_CHAR: string = '?';

// yargs が '-' を解析できないので、別の文字に置き換える
export const SINGLE_DASH_ALTERNATIVE: string = '<stdin>';

// 出力の最後に改行を追加するためのマーク
export const BREAK_AT_EOF = '\n';

export const SINGLE_QUOTATION = "'";
export const DOUBLE_QUOTATION = '"';

// 出力の空文字
export const BLANK_CHAR = null;

// 同時ダウンロード数
export const MAX_CONCURRENT_DOWNLOAD = 100;

// MatchLevel = Machiaza のとき、その地域に含まれる
// 大字・丁目・小字に rsdt_addr_flg = 0 と 1 が
// 混合する可能性がある。
// そこで、 -1 を出力する
export const AMBIGUOUS_RSDT_ADDR_FLG = -1;
