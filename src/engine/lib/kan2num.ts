import { kanji2number, findKanjiNumbers } from '@geolonia/japanese-numeral'

export const kan2num = (string: string) => {
  const kanjiNumbers = findKanjiNumbers(string)
  for (let i = 0; i < kanjiNumbers.length; i++) {
    string = string.replace(
      kanjiNumbers[i],
      kanji2number(kanjiNumbers[i]).toString(),
    )
  }

  return string
}
