import { kanji2number, findKanjiNumbers } from '@geolonia/japanese-numeral'

/**
 * オリジナルコード
 * https://github.com/digital-go-jp/abr-geocoder/blob/main/src/engine/lib/kan2num.ts
 */
export const kan2num = (target: string) => {
  const kanjiNumbers = findKanjiNumbers(target)
  for (let i = 0; i < kanjiNumbers.length; i++) {
    target = target.replace(
      kanjiNumbers[i],
      kanji2number(kanjiNumbers[i]).toString(),
    )
  }

  return target
}