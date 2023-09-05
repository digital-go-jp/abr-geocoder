import { IAddressPatch, PrefectureName } from '../usecase';

export const patchPatterns: IAddressPatch[] = [
  {
    prefecture: '香川県' as PrefectureName,
    city: '仲多度郡まんのう町',
    town: '勝浦',
    regExpPattern: '^字?家6',
    result: '家六',
  },
  {
    prefecture: '愛知県' as PrefectureName,
    city: 'あま市',
    town: '西今宿',
    regExpPattern: '^字?梶村1',
    result: '梶村一',
  },
  {
    prefecture: '香川県' as PrefectureName,
    city: '丸亀市',
    town: '原田町',
    regExpPattern: '^字?東三分1',
    result: '東三分一',
  },
];
