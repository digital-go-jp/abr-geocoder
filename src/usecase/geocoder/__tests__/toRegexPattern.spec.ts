import { describe, expect, it, jest } from '@jest/globals';
import { jisKanji } from '../../../domain';
import { toRegexPattern } from '../../geocoder';


jest.mock('../../../domain', () => ({
  ...(jest.requireActual('../../../domain') as typeof import('../../../domain')),
  jisKanji: jest.fn().mockImplementation((text) => {
    return text;
  }),
}))
describe('toRegexPattern', () => {
  it.concurrent('cases for the 三栄町|四谷三栄町', async () => {
    expect(toRegexPattern('東京都新宿区四谷三栄町')).toEqual('東京都新宿区(三栄町|四谷三栄町)');
    expect(toRegexPattern('三重県桑名市三栄町')).toEqual('三重県桑名(市|巿)(三栄町|四谷三栄町)');
    expect(toRegexPattern('三重県四日市市三栄町')).toEqual('三重県四日(市|巿)(市|巿)(三栄町|四谷三栄町)');
  });
  it.concurrent('case for the 鬮野川|くじ野川|くじの川', async () => {
    expect(toRegexPattern('和歌山県東牟婁郡串本町鬮野川1234')).toEqual('和歌山県東牟婁郡串本町(鬮野川|くじ野川|くじ[のノ之丿]川)1234');
  });
  it.concurrent('case for the 埠頭|ふ頭', async () => {
    expect(toRegexPattern('横浜市鶴見区大黒埠頭111111番地')).toEqual('横浜(市|巿)鶴見区大黒(埠頭|ふ頭)111111番地');
  });
  it.concurrent('case for the 番町|番丁', async () => {
    expect(toRegexPattern('東京都千代田区一番町')).toEqual('東京都千代田区一(番町|番丁)');
  });
  it.concurrent('case for the 大冝|大宜', async () => {
    expect(toRegexPattern('岡山県笠岡市大宜1234')).toEqual('岡山県笠岡(市|巿)(大冝|大宜)1234');
  });
  it.concurrent('case for the 穝|さい', async () => {
    expect(toRegexPattern('岡山市中区穝1234')).toEqual('岡山(市|巿)中区(穝|さい)1234');
  });
  it.concurrent('case for the 杁|えぶり', async () => {
    expect(toRegexPattern('愛知県春日井市杁ケ島町')).toEqual('愛知県春日井(市|巿)(杁|(エ|ヱ|え)ぶり)[ヶケが]島町');
  });
  it.concurrent('case for the 薭|稗|ひえ|ヒエ', async () => {
    expect(toRegexPattern('小千谷市薭生字谷内田丙1234')).toEqual('小千谷(市|巿)(薭|稗|ひ(エ|ヱ|え)|ヒ(エ|ヱ|え))生字谷内田丙1234');
  });
})