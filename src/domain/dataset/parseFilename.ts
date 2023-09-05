import path from 'node:path';
import { IDatasetFileMeta } from './types';

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
