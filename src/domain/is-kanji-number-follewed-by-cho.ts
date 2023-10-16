import { findKanjiNumbers } from '@geolonia/japanese-numeral';
import { RegExpEx } from './reg-exp-ex';

/**
 * targetTownName 内に 「漢数字 + 町」の地名がある場合、trueを返す
 * @param targetTownName
 * @returns
 */
export const isKanjiNumberFollewedByCho = (targetTownName: string) => {
  const xCho = targetTownName.match(RegExpEx.create('.町', 'g'));
  if (!xCho) return false;

  const kanjiNumbers = findKanjiNumbers(xCho[0]);
  return kanjiNumbers.length > 0;
};
