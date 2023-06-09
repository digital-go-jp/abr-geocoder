"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalize = exports.__internals = exports.config = void 0;
const japanese_numeral_1 = require("@geolonia/japanese-numeral");
const config_1 = require("./config");
const kan2num_1 = require("./lib/kan2num");
const zen2han_1 = require("./lib/zen2han");
const patchAddr_1 = require("./lib/patchAddr");
const cacheRegexes_1 = require("./lib/cacheRegexes");
const formatting_1 = require("./formatting");
const dict_1 = require("./lib/dict");
exports.config = config_1.currentConfig;
const defaultOption = {
    level: 8,
};
/**
 * @internal
 */
exports.__internals = {
    // default fetch
    fetch: async (input) => {
        return {
            json: async () => ({}),
        };
    },
};
async function normalizeTownName(inputOther, pref, city, fuzzy) {
    const other = inputOther.trim().replace(/^大字/, '');
    const townPatterns = await (0, cacheRegexes_1.getTownRegexPatterns)(pref, city);
    const regexPrefixes = ['^'];
    if (city.match(/^京都市/)) {
        // 京都は通り名削除のために後方一致を使う
        regexPrefixes.push('.*');
    }
    for (const regexPrefix of regexPrefixes) {
        for (const [town, rawPattern] of townPatterns) {
            let pattern = rawPattern;
            // `pattern` is a regex that will match on `other` string.
            if (fuzzy) {
                // in `other`, there may be a `?` wildcard character that should match any one character.
                pattern = (0, dict_1.insertWildcardMatching)(pattern);
            }
            const regex = new RegExp(`${regexPrefix}${pattern}`);
            const match = other.match(regex);
            if (match) {
                return {
                    town: town.originalTown || town.town,
                    town_id: town.town_id,
                    other: other.substring(match[0].length),
                    lat: town.lat,
                    lon: town.lon,
                };
            }
        }
    }
}
async function normalizeResidentialPart(inputOther, pref, city, town) {
    const [blkList, rsdtList] = await Promise.all([
        (0, cacheRegexes_1.getBlkList)(pref, city, town),
        (0, cacheRegexes_1.getRsdtList)(pref, city, town),
    ]);
    // 住居表示未整備
    if (blkList.length === 0) {
        return undefined;
    }
    const match = inputOther.match(/^([1-9][0-9]*)(?:-([1-9][0-9]*))?(?:-([1-9][0-9]*))?/);
    if (match) {
        const matchedString = match[0];
        const other = inputOther.substring(matchedString.length).trim();
        const blk = match[1];
        const addr1 = match[2];
        const addr2 = match[3];
        const jyukyohyoji = (0, formatting_1.formatResidentialSection)({ blk, addr1, addr2 });
        const residentialWithAddr2 = rsdtList.find((res) => (0, formatting_1.formatResidentialSection)(res) === jyukyohyoji);
        if (residentialWithAddr2) {
            return {
                blk,
                blk_id: residentialWithAddr2.blk_id,
                addr1: addr1,
                addr1_id: residentialWithAddr2.addr1_id,
                addr2: addr2 || "",
                addr2_id: residentialWithAddr2.addr2_id,
                other,
                lat: residentialWithAddr2.lat,
                lon: residentialWithAddr2.lon,
            };
        }
        if (addr2) {
            // まずはaddr2を削って再度検索
            const jyukyohyoji = (0, formatting_1.formatResidentialSection)({ blk, addr1 });
            const residential = rsdtList.find((res) => (0, formatting_1.formatResidentialSection)(res) === jyukyohyoji);
            if (residential) {
                return {
                    blk,
                    blk_id: residential.blk_id,
                    addr1: addr1,
                    addr1_id: residential.addr1_id,
                    addr2: "",
                    addr2_id: "",
                    other: (addr2 ? `-${addr2}` : '') + other,
                    lat: residential.lat,
                    lon: residential.lon,
                };
            }
        }
        const singleBlk = blkList.find((item) => item.blk === blk);
        const otherWithUnmatchedAddrs = (addr1 ? `-${addr1}` : '') + (addr2 ? `-${addr2}` : '') + other;
        if (singleBlk) {
            return {
                blk,
                blk_id: singleBlk.blk_id,
                other: otherWithUnmatchedAddrs,
                lat: singleBlk.lat,
                lon: singleBlk.lon,
            };
        }
    }
    return undefined;
}
const normalize = async (address, _option = defaultOption) => {
    const option = { ...defaultOption, ..._option };
    /**
     * 入力された住所に対して以下の正規化を予め行う。
     *
     * 1. `1-2-3` や `四-五-六` のようなフォーマットのハイフンを半角に統一。
     * 2. 町丁目以前にあるスペースをすべて削除。
     * 3. 最初に出てくる `1-` や `五-` のような文字列を町丁目とみなして、それ以前のスペースをすべて削除する。
     */
    let other = address
        .normalize('NFC')
        .replace(/　/g, ' ')
        .replace(/ +/g, ' ')
        .replace(/([０-９Ａ-Ｚａ-ｚ]+)/g, (match) => {
        // 全角のアラビア数字は問答無用で半角にする
        return (0, zen2han_1.zen2han)(match);
    })
        // 数字の後または数字の前にくる横棒はハイフンに統一する
        .replace(/([0-9０-９一二三四五六七八九〇十百千][-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━])|([-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━])[0-9０-９一二三四五六七八九〇十]/g, (match) => {
        return match.replace(/[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]/g, '-');
    })
        .replace(/(.+)(丁目?|番(町|地|丁)|条|軒|線|(の|ノ)町|地割)/, (match) => {
        return match.replace(/ /g, ''); // 町丁目名以前のスペースはすべて削除
    })
        .replace(/(.+)((郡.+(町|村))|((市|巿).+(区|區)))/, (match) => {
        return match.replace(/ /g, ''); // 区、郡以前のスペースはすべて削除
    })
        .replace(/.+?[0-9一二三四五六七八九〇十百千]-/, (match) => {
        return match.replace(/ /g, ''); // 1番はじめに出てくるアラビア数字以前のスペースを削除
    });
    let pref = '';
    let city = '';
    let lg_code;
    let town = '';
    let town_id;
    let lat = null;
    let lon = null;
    let level = 0;
    let normalized;
    // 都道府県名の正規化
    const prefectures = await (0, cacheRegexes_1.getPrefectures)();
    const prefs = Object.keys(prefectures);
    const prefPatterns = (0, cacheRegexes_1.getPrefectureRegexPatterns)(prefs);
    const sameNamedPrefectureCityRegexPatterns = (0, cacheRegexes_1.getSameNamedPrefectureCityRegexPatterns)(prefs, prefectures);
    // 県名が省略されており、かつ市の名前がどこかの都道府県名と同じ場合(例.千葉県千葉市)、
    // あらかじめ県名を補完しておく。
    for (const [prefectureCity, reg] of sameNamedPrefectureCityRegexPatterns) {
        const match = other.match(option.fuzzy ? (0, dict_1.insertWildcardMatching)(reg) : reg);
        if (match) {
            other = other.replace(new RegExp(reg), prefectureCity);
            break;
        }
    }
    for (const [_pref, pattern] of prefPatterns) {
        const match = other.match(option.fuzzy ? (0, dict_1.insertWildcardMatching)(pattern) : pattern);
        if (match) {
            pref = _pref;
            other = other.substring(match[0].length); // 都道府県名以降の住所
            break;
        }
    }
    if (!pref) {
        // 都道府県名が省略されている
        const matched = [];
        for (const _pref in prefectures) {
            const cities = prefectures[_pref];
            const cityPatterns = (0, cacheRegexes_1.getCityRegexPatterns)(_pref, cities);
            other = other.trim();
            for (let i = 0; i < cityPatterns.length; i++) {
                const [_city, pattern] = cityPatterns[i];
                const match = other.match(option.fuzzy ? (0, dict_1.insertWildcardMatching)(pattern) : pattern);
                if (match) {
                    matched.push({
                        pref: _pref,
                        city: _city,
                        other: other.substring(match[0].length),
                    });
                }
            }
        }
        // マッチする都道府県が複数ある場合は町名まで正規化して都道府県名を判別する。（例: 東京都府中市と広島県府中市など）
        if (1 === matched.length) {
            const matchedCity = matched[0];
            pref = matchedCity.pref;
        }
        else {
            for (const matchedCity of matched) {
                const normalized = await normalizeTownName(matchedCity.other, matchedCity.pref, matchedCity.city.name, !!option.fuzzy);
                if (normalized) {
                    pref = matchedCity.pref;
                }
            }
        }
    }
    if (pref && option.level >= 2) {
        const cities = prefectures[pref];
        const cityPatterns = (0, cacheRegexes_1.getCityRegexPatterns)(pref, cities);
        other = other.trim();
        for (const [_city, pattern] of cityPatterns) {
            const match = other.match(option.fuzzy ? (0, dict_1.insertWildcardMatching)(pattern) : pattern);
            if (match) {
                city = _city.name;
                lg_code = _city.code;
                other = other.substring(match[0].length); // 市区町村名以降の住所
                break;
            }
        }
    }
    // 町丁目以降の正規化
    if (city && option.level >= 3) {
        normalized = await normalizeTownName(other, pref, city, !!option.fuzzy);
        if (normalized) {
            town = normalized.town;
            town_id = normalized.town_id;
            other = normalized.other;
            lat = parseFloat(normalized.lat);
            lon = parseFloat(normalized.lon);
            if (Number.isNaN(lat) || Number.isNaN(lon)) {
                lat = null;
                lon = null;
            }
        }
        // townが取得できた場合にのみ、addrに対する各種の変換処理を行う。
        if (town) {
            other = other
                .replace(/^-/, '')
                .replace(/([0-9]+)(丁目)/g, (match) => {
                return match.replace(/([0-9]+)/g, (num) => {
                    return (0, japanese_numeral_1.number2kanji)(Number(num));
                });
            })
                .replace(/(([0-9〇一二三四五六七八九十百千]+)(番地?)([0-9〇一二三四五六七八九十百千]+)号)\s*(.+)/, '$1 $5')
                .replace(/([0-9〇一二三四五六七八九十百千]+)(番地?)([0-9〇一二三四五六七八九十百千]+)号?/, '$1-$3')
                .replace(/([0-9〇一二三四五六七八九十百千]+)番地?/, '$1')
                .replace(/([0-9〇一二三四五六七八九十百千]+)の/g, '$1-')
                .replace(/([0-9〇一二三四五六七八九十百千]+)[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]/g, (match) => {
                return (0, kan2num_1.kan2num)(match).replace(/[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]/g, '-');
            })
                .replace(/[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]([0-9〇一二三四五六七八九十百千]+)/g, (match) => {
                return (0, kan2num_1.kan2num)(match).replace(/[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]/g, '-');
            })
                .replace(/([0-9〇一二三四五六七八九十百千]+)-/, (s) => {
                // `1-` のようなケース
                return (0, kan2num_1.kan2num)(s);
            })
                .replace(/-([0-9〇一二三四五六七八九十百千]+)/, (s) => {
                // `-1` のようなケース
                return (0, kan2num_1.kan2num)(s);
            })
                .replace(/-[^0-9]+([0-9〇一二三四五六七八九十百千]+)/, (s) => {
                // `-あ1` のようなケース
                return (0, kan2num_1.kan2num)((0, zen2han_1.zen2han)(s));
            })
                .replace(/([0-9〇一二三四五六七八九十百千]+)$/, (s) => {
                // `串本町串本１２３４` のようなケース
                return (0, kan2num_1.kan2num)(s);
            })
                .trim();
        }
    }
    other = (0, patchAddr_1.patchAddr)(pref, city, town, other);
    // 住居表示住所リストを使い番地号までの正規化を行う
    if (option.level > 3 && normalized && town) {
        const rsdtNormalized = await normalizeResidentialPart(other, pref, city, town);
        if (rsdtNormalized) {
            other = rsdtNormalized.other;
            normalized = rsdtNormalized;
        }
    }
    if (normalized) {
        lat = parseFloat(normalized.lat);
        lon = parseFloat(normalized.lon);
    }
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
        lat = null;
        lon = null;
    }
    if (pref)
        level = level + 1;
    if (city)
        level = level + 1;
    if (town)
        level = level + 1;
    const result = {
        pref,
        city,
        lg_code,
        town,
        town_id,
        other,
        lat,
        lon,
        level,
    };
    if (normalized && 'blk' in normalized) {
        result.addr1 = normalized.addr1;
        result.blk = normalized.blk;
        result.blk_id = normalized.blk_id;
        result.level = 7;
    }
    if (normalized && 'addr1' in normalized) {
        result.addr1 = normalized.addr1;
        result.addr1_id = normalized.addr1_id;
        if ('addr2' in normalized) {
            result.addr2 = normalized.addr2;
            result.addr2_id = normalized.addr2_id;
        }
        result.level = 8;
    }
    return result;
};
exports.normalize = normalize;
