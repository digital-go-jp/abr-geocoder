import {toRegexPattern} from './dict';
import {kan2num} from './kan2num';
import LRU from 'lru-cache';
import {currentConfig} from '../config';
import {internals} from '../normalize';
import {findKanjiNumbers} from '@geolonia/japanese-numeral';
import {formatResidentialSection} from '../formatting';

export type SingleCity = {
  // 市区町村名
  name: string;

  // 全国地方公共団体コード
  code: string;
};
type PrefectureList = {[key: string]: SingleCity[]};

interface SingleTown {
  // 全国地方公共団体コード
  code: string;
  // 町字id
  town_id: string;

  town: string;
  originalTown?: string;
  koaza: string;
  lat: string;
  lon: string;
}
type TownList = SingleTown[];

interface SingleBlk {
  // 全国地方公共団体コード
  code: string;
  // 町字id
  town_id: string;
  blk_id: string;

  blk: string;
  lat: string;
  lon: string;
}
type BlkList = SingleBlk[];

interface SingleRsdt {
  // 全国地方公共団体コード
  code: string;
  // 町字id
  town_id: string;
  blk_id: string;
  addr1_id: string;
  addr2_id: string;

  blk: string;
  addr: string;
  addr2: string;
  lat: string;
  lon: string;
}
type RsdtList = SingleRsdt[];

const cachedTownRegexes = new LRU<string, [SingleTown, string][]>({
  max: currentConfig.townCacheSize,
});

let cachedPrefecturePatterns: [string, string][] | undefined = undefined;
const cachedCityPatterns: {[key: string]: [SingleCity, string][]} = {};
let cachedPrefectures: PrefectureList | undefined = undefined;
const cachedTowns: {[key: string]: TownList} = {};
const cachedBlkLists: {[key: string]: BlkList} = {};
const cachedRsdtLists: {[key: string]: RsdtList} = {};
let cachedSameNamedPrefectureCityRegexPatterns: [string, string][] | undefined =
  undefined;

export const getPrefectures = async () => {
  if (typeof cachedPrefectures !== 'undefined') {
    return cachedPrefectures;
  }

  const prefsResp = await internals.fetch('.json'); // ja.json
  const data = (await prefsResp.json()) as PrefectureList;
  return cachePrefectures(data);
};

export const cachePrefectures = (data: PrefectureList) => {
  return (cachedPrefectures = data);
};

export const getPrefectureRegexPatterns = (prefs: string[]) => {
  if (cachedPrefecturePatterns) {
    return cachedPrefecturePatterns;
  }

  cachedPrefecturePatterns = prefs.map(pref => {
    const prefecturePrefix = pref.replace(/(都|道|府|県)$/, ''); // `東京` の様に末尾の `都府県` が抜けた住所に対応
    const pattern = `^${prefecturePrefix}(都|道|府|県)?`;
    return [pref, pattern];
  });

  return cachedPrefecturePatterns;
};

export const getCityRegexPatterns = (pref: string, cities: SingleCity[]) => {
  const cachedResult = cachedCityPatterns[pref];
  if (typeof cachedResult !== 'undefined') {
    return cachedResult;
  }

  // 少ない文字数の地名に対してミスマッチしないように文字の長さ順にソート
  cities.sort((a, b) => {
    return b.name.length - a.name.length;
  });

  const patterns = cities.map(city => {
    let pattern = `^${toRegexPattern(city.name)}`;
    if (city.name.match(/(町|村)$/)) {
      pattern = `^${toRegexPattern(city.name).replace(/(.+?)郡/, '($1郡)?')}`; // 郡が省略されてるかも
    }
    return [city, pattern] as [SingleCity, string];
  });

  cachedCityPatterns[pref] = patterns;
  return patterns;
};

export const getTowns = async (pref: string, city: string) => {
  const cacheKey = `${pref}-${city}`;
  const cachedTown = cachedTowns[cacheKey];
  if (typeof cachedTown !== 'undefined') {
    return cachedTown;
  }

  const townsResp = await internals.fetch(
    ['', encodeURI(pref), encodeURI(city) + '.json'].join('/')
  );
  const towns = (await townsResp.json()) as TownList;
  return (cachedTowns[cacheKey] = towns);
};

export const getBlkList = async (pref: string, city: string, town: string) => {
  const cacheKey = `${pref}-${city}-${town}`;
  const cache = cachedBlkLists[cacheKey];
  if (typeof cache !== 'undefined') {
    return cache;
  }
  const blkResp = await internals.fetch(
    ['', encodeURI(pref), encodeURI(city), encodeURI(town + '.json')].join('/')
  );
  let singleBlk: SingleBlk[];
  try {
    singleBlk = (await blkResp.json()) as SingleBlk[];
  } catch {
    singleBlk = [];
  }
  return (cachedBlkLists[cacheKey] = singleBlk);
};

export const getRsdtList = async (pref: string, city: string, town: string) => {
  const cacheKey = `${pref}-${city}-${town}`;
  const cache = cachedRsdtLists[cacheKey];
  if (typeof cache !== 'undefined') {
    return cache;
  }

  const rsdtListResp = await internals.fetch(
    [
      '',
      encodeURI(pref),
      encodeURI(city),
      encodeURI(town),
      encodeURI('住居表示.json'),
    ].join('/')
  );
  let rsdtList: RsdtList;
  try {
    rsdtList = (await rsdtListResp.json()) as RsdtList;
  } catch {
    rsdtList = [];
  }

  rsdtList.sort(
    (res1, res2) =>
      formatResidentialSection(res2).length -
      formatResidentialSection(res1).length
  );
  return (cachedRsdtLists[cacheKey] = rsdtList);
};

// 十六町 のように漢数字と町が連結しているか
const isKanjiNumberFollewedByCho = (targetTownName: string) => {
  const xCho = targetTownName.match(/.町/g);
  if (!xCho) return false;
  const kanjiNumbers = findKanjiNumbers(xCho[0]);
  return kanjiNumbers.length > 0;
};

export const getTownRegexPatterns = async (pref: string, city: string) => {
  const cachedResult = cachedTownRegexes.get(`${pref}-${city}`);
  if (typeof cachedResult !== 'undefined') {
    return cachedResult;
  }

  const pre_towns = await getTowns(pref, city);
  const townSet = new Set(pre_towns.map(town => town.town));
  const towns = [];

  const isKyoto = city.match(/^京都市/);

  // 町丁目に「○○町」が含まれるケースへの対応
  // 通常は「○○町」のうち「町」の省略を許容し同義語として扱うが、まれに自治体内に「○○町」と「○○」が共存しているケースがある。
  // この場合は町の省略は許容せず、入力された住所は書き分けられているものとして正規化を行う。
  // 更に、「愛知県名古屋市瑞穂区十六町1丁目」漢数字を含むケースだと丁目や番地・号の正規化が不可能になる。このようなケースも除外。
  for (const town of pre_towns) {
    towns.push(town);

    const originalTown = town.town;
    if (originalTown.indexOf('町') === -1) continue;
    const townAbbr = originalTown.replace(/(?!^町)町/g, ''); // NOTE: 冒頭の「町」は明らかに省略するべきではないので、除外
    if (
      !isKyoto && // 京都は通り名削除の処理があるため、意図しないマッチになるケースがある。これを除く
      !townSet.has(townAbbr) &&
      !townSet.has(`大字${townAbbr}`) && // 大字は省略されるため、大字〇〇と〇〇町がコンフリクトする。このケースを除外
      !isKanjiNumberFollewedByCho(originalTown)
    ) {
      // エイリアスとして町なしのパターンを登録
      towns.push({
        ...town,
        originalTown,
        town: townAbbr,
      });
    }
  }

  // 少ない文字数の地名に対してミスマッチしないように文字の長さ順にソート
  towns.sort((a, b) => {
    let aLen = a.town.length;
    let bLen = b.town.length;

    // 大字で始まる場合、優先度を低く設定する。
    // 大字XX と XXYY が存在するケースもあるので、 XXYY を先にマッチしたい
    if (a.town.startsWith('大字')) aLen -= 2;
    if (b.town.startsWith('大字')) bLen -= 2;

    return bLen - aLen;
  });

  const patterns = towns.map(town => {
    const pattern = toRegexPattern(
      town.town
        // 横棒を含む場合（流通センター、など）に対応
        .replace(/[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]/g, '[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]')
        .replace(/大?字/g, '(大?字)?')
        // 以下住所マスターの町丁目に含まれる数字を正規表現に変換する
        .replace(
          /([壱一二三四五六七八九十]+)(丁目?|番(町|丁)|条|軒|線|(の|ノ)町|地割|号)/g,
          (match: string) => {
            const patterns = [];

            patterns.push(
              match
                .toString()
                .replace(/(丁目?|番(町|丁)|条|軒|線|(の|ノ)町|地割|号)/, '')
            ); // 漢数字

            if (match.match(/^壱/)) {
              patterns.push('一');
              patterns.push('1');
              patterns.push('１');
            } else {
              const num = match
                .replace(/([一二三四五六七八九十]+)/g, match => {
                  return kan2num(match);
                })
                .replace(/(丁目?|番(町|丁)|条|軒|線|(の|ノ)町|地割|号)/, '');

              patterns.push(num.toString()); // 半角アラビア数字
            }

            // 以下の正規表現は、上のよく似た正規表現とは違うことに注意！
            const resultPattern = `(${patterns.join(
              '|'
            )})((丁|町)目?|番(町|丁)|条|軒|線|の町?|地割|号|[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━])`;
            return resultPattern; // デバッグのときにめんどくさいので変数に入れる。
          }
        )
    );

    return [town, pattern];
  }) as [SingleTown, string][];

  // X丁目の丁目なしの数字だけ許容するため、最後に数字だけ追加していく
  for (const town of towns) {
    const chomeMatch = town.town.match(
      /([^一二三四五六七八九十]+)([一二三四五六七八九十]+)(丁目?)/
    );
    if (!chomeMatch) {
      continue;
    }
    const chomeNamePart = chomeMatch[1];
    const chomeNum = chomeMatch[2];
    const pattern = toRegexPattern(
      `^${chomeNamePart}(${chomeNum}|${kan2num(chomeNum)})`
    );
    patterns.push([town, pattern]);
  }

  cachedTownRegexes.set(`${pref}-${city}`, patterns);
  return patterns;
};

export const getSameNamedPrefectureCityRegexPatterns = (
  prefs: string[],
  prefList: PrefectureList
) => {
  if (typeof cachedSameNamedPrefectureCityRegexPatterns !== 'undefined') {
    return cachedSameNamedPrefectureCityRegexPatterns;
  }

  const prefecturePrefixes = prefs.map(pref => {
    return pref.replace(/[都|道|府|県]$/, '');
  });

  cachedSameNamedPrefectureCityRegexPatterns = [];
  for (const pref in prefList) {
    for (let i = 0; i < prefList[pref].length; i++) {
      const city = prefList[pref][i];

      // 「福島県石川郡石川町」のように、市の名前が別の都道府県名から始まっているケースも考慮する。
      for (let j = 0; j < prefecturePrefixes.length; j++) {
        if (city.name.indexOf(prefecturePrefixes[j]) === 0) {
          cachedSameNamedPrefectureCityRegexPatterns.push([
            `${pref}${city}`,
            `^${city}`,
          ]);
        }
      }
    }
  }

  return cachedSameNamedPrefectureCityRegexPatterns;
};
