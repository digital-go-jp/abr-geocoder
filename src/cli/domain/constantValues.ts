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
  '一', // いち
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

export const SPACE: string = ' ';

// 全角ハイフンを半角ハイフンに置き換えると、
// 正規表現の範囲を示すために用いる半角ハイフンと被ってしまい
// 問題を起こしやすいので、_(半角underscore) に置き換える
// 基本的に住所には含まれていなはず
export const DASH_ALT: string = '_';

export const SPACE_SYMBOLS: string = [
  ' ', // 半角スペース
  '　', // 全角スペース
].join('');
