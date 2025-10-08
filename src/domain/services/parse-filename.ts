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
import { AbrgError, AbrgErrorLevel } from '@domain/types/messages/abrg-error';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import path from 'node:path';
import { IDatasetFileMeta } from '../models/dataset-file';
import { FileGroup2Key, isFileGroupKey } from '../types/download/file-group';
import { PrefLgCode } from '../types/pref-lg-code';
import { RegExpEx } from './reg-exp-ex';

/**
 * リソースCSVファイルから、情報を読取る
 *
 * foo/bar/mt_rsdtdsp_blk_pref01.zip というファイル名から
 * 以下のように変換する
 *
 * {
 *   type: "rsdtdsp_blk",
 *   type2: "pref",
 *   lgCode : "01",
 *   prefLgCode: "010006",
 *   path: "foo/bar/mt_rsdtdsp_blk_pref01.zip",
 *   filename: "mt_rsdtdsp_blk_pref01.zip",
 * }
 *
 * @param filename
 * @returns
 */
export const parseFilename = (params: {
  filepath: string;
}): IDatasetFileMeta | null => {
  const filename = path.basename(params.filepath);

  const fileMatch = filename.match(
    /^mt_((?:city|pref|town|parcel|rsdtdsp_(?:rsdt|blk))(?:_pos)?)_(all|pref\d{2}|city\d{6})/,
  );
  if (!fileMatch || !isFileGroupKey(fileMatch[1])) {
    return null;
  }
  const type = fileMatch[1];
  
  const prefLgCode = ((rawValue: string) => {
    switch (true) {
      case rawValue === 'all': {
        return PrefLgCode.ALL; // mt_pref_all.csv と mt_town_all.csvのために返すが、使わない
      }

      case rawValue.startsWith('pref'):
      case rawValue.startsWith('city'): {
        const prefXX = rawValue.substring(4, 6);
        return Object.values(PrefLgCode)
          .find(prefCode => prefCode.startsWith(prefXX));
      }
      
      default: {
        throw new AbrgError({
          messageId: AbrgMessage.NOT_IMPLEMENTED,
          level: AbrgErrorLevel.ERROR,
        });
      }
    }
  })(fileMatch[2]);

  const type2 = fileMatch[2]
    .replaceAll(RegExpEx.create('[0-9]+', 'g'), '') as FileGroup2Key;

  const lgCode = (() => {
    const numericPart = fileMatch[2].replaceAll(RegExpEx.create('[^0-9]+', 'g'), '');
    // pref{NN}形式の場合は{NN}....にする
    if (type2 === 'pref') {
      return numericPart.padStart(2, '0') + '....';
    }
    return numericPart;
  })();

  if (!prefLgCode) {
    return null;
  }
  return {
    type,
    type2,
    lgCode,
    prefLgCode,
    path: params.filepath,
    filename,
  };
};
