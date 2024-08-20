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
// ダウンロードするCSVのファイル名のルール
export type FileGroupKey = 'pref' | 'pref_pos' | 'city' | 'city_pos' | 'town' | 'rsdtdsp_blk' | 'rsdtdsp_rsdt' | 'town_pos' | 'rsdtdsp_blk_pos' | 'rsdtdsp_rsdt_pos' | 'parcel' | 'parcel_pos';

export type FileGroup2Key = 'all' | 'pref' | 'city';

const FileGroupKeys = new Set([
  'pref', 'pref_pos', 'city', 'city_pos', 'town', 'rsdtdsp_blk', 'rsdtdsp_rsdt', 'town_pos', 'rsdtdsp_blk_pos', 'rsdtdsp_rsdt_pos', 'parcel', 'parcel_pos'
]);

export const isFileGroupKey = (target: string): target is FileGroupKey => {
  return FileGroupKeys.has(target);
};
