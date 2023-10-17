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
import { IDatasetFileMeta } from '@domain/dataset-file';
import path from 'node:path';

/**
 * リソースCSVファイルから、情報を読取る
 *
 * mt_rsdtdsp_blk_pref01.zip というファイル名から
 * 以下のように変換する
 *
 * {
 *   type: 'rsdtdsp_blk',
 *   fileArea: 'pref_01'
 * }
 *
 * @param filename
 * @returns
 */
export const parseFilename = ({
  filepath,
}: {
  filepath: string;
}): IDatasetFileMeta | null => {
  const filename = path.basename(filepath);

  const fileMatch = filename.match(
    /^mt_(city|pref|(?:town|rsdtdsp_(?:rsdt|blk))(?:_pos)?)_(all|pref\d{2})/
  );
  if (!fileMatch) {
    return null;
  }
  const type = fileMatch[1];
  const fileArea = fileMatch[2];
  return {
    type,
    fileArea,
    path: filepath,
    filename,
  };
};
