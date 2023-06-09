"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSameNamedPrefectureCityRegexPatterns = exports.getTownRegexPatterns = exports.getRsdtList = exports.getBlkList = exports.getTowns = exports.getCityRegexPatterns = exports.getPrefectureRegexPatterns = exports.cachePrefectures = exports.getPrefectures = void 0;
const dict_1 = require("./dict");
const kan2num_1 = require("./kan2num");
const lru_cache_1 = __importDefault(require("lru-cache"));
const config_1 = require("../config");
const normalize_1 = require("../normalize");
const japanese_numeral_1 = require("@geolonia/japanese-numeral");
const formatting_1 = require("../formatting");
const cachedTownRegexes = new lru_cache_1.default({
    max: config_1.currentConfig.townCacheSize,
});
let cachedPrefecturePatterns = undefined;
const cachedCityPatterns = {};
let cachedPrefectures = undefined;
const cachedTowns = {};
const cachedBlkLists = {};
const cachedRsdtLists = {};
let cachedSameNamedPrefectureCityRegexPatterns = undefined;
const getPrefectures = async () => {
    if (typeof cachedPrefectures !== 'undefined') {
        return cachedPrefectures;
    }
    const prefsResp = await normalize_1.__internals.fetch('.json'); // ja.json
    const data = (await prefsResp.json());
    return (0, exports.cachePrefectures)(data);
};
exports.getPrefectures = getPrefectures;
const cachePrefectures = (data) => {
    return (cachedPrefectures = data);
};
exports.cachePrefectures = cachePrefectures;
const getPrefectureRegexPatterns = (prefs) => {
    if (cachedPrefecturePatterns) {
        return cachedPrefecturePatterns;
    }
    cachedPrefecturePatterns = prefs.map((pref) => {
        const _pref = pref.replace(/(都|道|府|県)$/, ''); // `東京` の様に末尾の `都府県` が抜けた住所に対応
        const pattern = `^${_pref}(都|道|府|県)?`;
        return [pref, pattern];
    });
    return cachedPrefecturePatterns;
};
exports.getPrefectureRegexPatterns = getPrefectureRegexPatterns;
const getCityRegexPatterns = (pref, cities) => {
    const cachedResult = cachedCityPatterns[pref];
    if (typeof cachedResult !== 'undefined') {
        return cachedResult;
    }
    // 少ない文字数の地名に対してミスマッチしないように文字の長さ順にソート
    cities.sort((a, b) => {
        return b.name.length - a.name.length;
    });
    const patterns = cities.map((city) => {
        let pattern = `^${(0, dict_1.toRegexPattern)(city.name)}`;
        if (city.name.match(/(町|村)$/)) {
            pattern = `^${(0, dict_1.toRegexPattern)(city.name).replace(/(.+?)郡/, '($1郡)?')}`; // 郡が省略されてるかも
        }
        return [city, pattern];
    });
    cachedCityPatterns[pref] = patterns;
    return patterns;
};
exports.getCityRegexPatterns = getCityRegexPatterns;
const getTowns = async (pref, city) => {
    const cacheKey = `${pref}-${city}`;
    const cachedTown = cachedTowns[cacheKey];
    if (typeof cachedTown !== 'undefined') {
        return cachedTown;
    }
    const townsResp = await normalize_1.__internals.fetch(['', encodeURI(pref), encodeURI(city) + '.json'].join('/'));
    const towns = (await townsResp.json());
    return (cachedTowns[cacheKey] = towns);
};
exports.getTowns = getTowns;
const getBlkList = async (pref, city, town) => {
    const cacheKey = `${pref}-${city}-${town}`;
    const cache = cachedBlkLists[cacheKey];
    if (typeof cache !== 'undefined') {
        return cache;
    }
    const blkResp = await normalize_1.__internals.fetch(['', encodeURI(pref), encodeURI(city), encodeURI(town + '.json')].join('/'));
    let singleBlk;
    try {
        singleBlk = (await blkResp.json());
    }
    catch {
        singleBlk = [];
    }
    return (cachedBlkLists[cacheKey] = singleBlk);
};
exports.getBlkList = getBlkList;
const getRsdtList = async (pref, city, town) => {
    const cacheKey = `${pref}-${city}-${town}`;
    const cache = cachedRsdtLists[cacheKey];
    if (typeof cache !== 'undefined') {
        return cache;
    }
    const rsdtListResp = await normalize_1.__internals.fetch([
        '',
        encodeURI(pref),
        encodeURI(city),
        encodeURI(town),
        encodeURI('住居表示.json'),
    ].join('/'));
    let rsdtList;
    try {
        rsdtList = (await rsdtListResp.json());
    }
    catch {
        rsdtList = [];
    }
    rsdtList.sort((res1, res2) => (0, formatting_1.formatResidentialSection)(res2).length -
        (0, formatting_1.formatResidentialSection)(res1).length);
    return (cachedRsdtLists[cacheKey] = rsdtList);
};
exports.getRsdtList = getRsdtList;
// 十六町 のように漢数字と町が連結しているか
const isKanjiNumberFollewedByCho = (targetTownName) => {
    const xCho = targetTownName.match(/.町/g);
    if (!xCho)
        return false;
    const kanjiNumbers = (0, japanese_numeral_1.findKanjiNumbers)(xCho[0]);
    return kanjiNumbers.length > 0;
};
const getTownRegexPatterns = async (pref, city) => {
    const cachedResult = cachedTownRegexes.get(`${pref}-${city}`);
    if (typeof cachedResult !== 'undefined') {
        return cachedResult;
    }
    const pre_towns = await (0, exports.getTowns)(pref, city);
    const townSet = new Set(pre_towns.map((town) => town.town));
    const towns = [];
    const isKyoto = city.match(/^京都市/);
    // 町丁目に「○○町」が含まれるケースへの対応
    // 通常は「○○町」のうち「町」の省略を許容し同義語として扱うが、まれに自治体内に「○○町」と「○○」が共存しているケースがある。
    // この場合は町の省略は許容せず、入力された住所は書き分けられているものとして正規化を行う。
    // 更に、「愛知県名古屋市瑞穂区十六町1丁目」漢数字を含むケースだと丁目や番地・号の正規化が不可能になる。このようなケースも除外。
    for (const town of pre_towns) {
        towns.push(town);
        const originalTown = town.town;
        if (originalTown.indexOf('町') === -1)
            continue;
        const townAbbr = originalTown.replace(/(?!^町)町/g, ''); // NOTE: 冒頭の「町」は明らかに省略するべきではないので、除外
        if (!isKyoto && // 京都は通り名削除の処理があるため、意図しないマッチになるケースがある。これを除く
            !townSet.has(townAbbr) &&
            !townSet.has(`大字${townAbbr}`) && // 大字は省略されるため、大字〇〇と〇〇町がコンフリクトする。このケースを除外
            !isKanjiNumberFollewedByCho(originalTown)) {
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
        if (a.town.startsWith('大字'))
            aLen -= 2;
        if (b.town.startsWith('大字'))
            bLen -= 2;
        return bLen - aLen;
    });
    const patterns = towns.map((town) => {
        const pattern = (0, dict_1.toRegexPattern)(town.town
            // 横棒を含む場合（流通センター、など）に対応
            .replace(/[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]/g, '[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]')
            .replace(/大?字/g, '(大?字)?')
            // 以下住所マスターの町丁目に含まれる数字を正規表現に変換する
            .replace(/([壱一二三四五六七八九十]+)(丁目?|番(町|丁)|条|軒|線|(の|ノ)町|地割|号)/g, (match) => {
            const patterns = [];
            patterns.push(match
                .toString()
                .replace(/(丁目?|番(町|丁)|条|軒|線|(の|ノ)町|地割|号)/, '')); // 漢数字
            if (match.match(/^壱/)) {
                patterns.push('一');
                patterns.push('1');
                patterns.push('１');
            }
            else {
                const num = match
                    .replace(/([一二三四五六七八九十]+)/g, (match) => {
                    return (0, kan2num_1.kan2num)(match);
                })
                    .replace(/(丁目?|番(町|丁)|条|軒|線|(の|ノ)町|地割|号)/, '');
                patterns.push(num.toString()); // 半角アラビア数字
            }
            // 以下の正規表現は、上のよく似た正規表現とは違うことに注意！
            const _pattern = `(${patterns.join('|')})((丁|町)目?|番(町|丁)|条|軒|線|の町?|地割|号|[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━])`;
            return _pattern; // デバッグのときにめんどくさいので変数に入れる。
        }));
        return [town, pattern];
    });
    // X丁目の丁目なしの数字だけ許容するため、最後に数字だけ追加していく
    for (const town of towns) {
        const chomeMatch = town.town.match(/([^一二三四五六七八九十]+)([一二三四五六七八九十]+)(丁目?)/);
        if (!chomeMatch) {
            continue;
        }
        const chomeNamePart = chomeMatch[1];
        const chomeNum = chomeMatch[2];
        const pattern = (0, dict_1.toRegexPattern)(`^${chomeNamePart}(${chomeNum}|${(0, kan2num_1.kan2num)(chomeNum)})`);
        patterns.push([town, pattern]);
    }
    cachedTownRegexes.set(`${pref}-${city}`, patterns);
    return patterns;
};
exports.getTownRegexPatterns = getTownRegexPatterns;
const getSameNamedPrefectureCityRegexPatterns = (prefs, prefList) => {
    if (typeof cachedSameNamedPrefectureCityRegexPatterns !== 'undefined') {
        return cachedSameNamedPrefectureCityRegexPatterns;
    }
    const _prefs = prefs.map((pref) => {
        return pref.replace(/[都|道|府|県]$/, '');
    });
    cachedSameNamedPrefectureCityRegexPatterns = [];
    for (const pref in prefList) {
        for (let i = 0; i < prefList[pref].length; i++) {
            const city = prefList[pref][i];
            // 「福島県石川郡石川町」のように、市の名前が別の都道府県名から始まっているケースも考慮する。
            for (let j = 0; j < _prefs.length; j++) {
                if (city.name.indexOf(_prefs[j]) === 0) {
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
exports.getSameNamedPrefectureCityRegexPatterns = getSameNamedPrefectureCityRegexPatterns;
