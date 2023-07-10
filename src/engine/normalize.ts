import { number2kanji } from '@geolonia/japanese-numeral'
import { currentConfig } from './config'
import { kan2num } from './lib/kan2num'
import { zen2han } from './lib/zen2han'
import { patchAddr } from './lib/patchAddr'
import {
  getPrefectures,
  getPrefectureRegexPatterns,
  getCityRegexPatterns,
  getTownRegexPatterns,
  getSameNamedPrefectureCityRegexPatterns,
  getRsdtList,
  getBlkList,
  SingleCity,
} from './lib/cacheRegexes'
import { formatResidentialSection } from './formatting'
import { insertWildcardMatching } from './lib/dict'

/**
 * normalize {@link Normalizer} の動作オプション。
 */
export interface Config {
  /** 町丁目のデータを何件までキャッシュするか。デフォルト 1,000 */
  townCacheSize: number
}
export const config: Config = currentConfig

/**
 * 住所の正規化結果として戻されるオブジェクト
 */
export interface NormalizeResult {
  /** 都道府県 */
  pref?: string
  /** 市区町村 */
  city?: string
  /** 町丁目 */
  town?: string

  /** 全国地方公共団体コード (5桁) */
  lg_code?: string

  /** アドレス・ベース・レジストリの「町字id」 */
  town_id?: string
  /** アドレス・ベース・レジストリの「街区id」 */
  blk_id?: string
  /** アドレス・ベース・レジストリの「住居id」 */
  addr1_id?: string
  /** アドレス・ベース・レジストリの「住居2id」 */
  addr2_id?: string

  /** 住居表示住所における街区符号 */
  blk?: string
  /** 住居表示住所における住居番号 (その1) */
  addr1?: string
  /** 住居表示住所における住居番号 (その2) */
  addr2?: string

  /** 正規化後の住所文字列 */
  other: string
  /** 緯度。データが存在しない場合は null */
  lat: number | null
  /** 経度。データが存在しない場合は null */
  lon: number | null

  /**
   * 住所文字列をどこまで判別できたかを表す正規化レベル
   * - 0 - 都道府県も判別できなかった。
   * - 1 - 都道府県まで判別できた。
   * - 2 - 市区町村まで判別できた。
   * - 3 - 町丁目まで判別できた。
   * - 7 - 住居表示住所の街区までの判別ができた。
   * - 8 - 住居表示住所の街区符号・住居番号までの判別ができた。
   */
  level: number
}

/**
 * 正規化関数の {@link normalize} のオプション
 */
export interface Option {
  /**
   * 正規化を行うレベルを指定します。{@link Option.level}
   *
   * @see https://github.com/geolonia/normalize-japanese-addresses#normalizeaddress-string
   */
  level?: number

  fuzzy?: boolean
}

/**
 * 住所を正規化します。
 *
 * @param input - 住所文字列
 * @param option -  正規化のオプション {@link Option}
 *
 * @returns 正規化結果のオブジェクト {@link NormalizeResult}
 *
 * @see https://github.com/geolonia/normalize-japanese-addresses#normalizeaddress-string
 */
export type Normalizer = (
  input: string,
  option?: Option,
) => Promise<NormalizeResult>

export type FetchLike = (
  input: string,
) => Promise<Response | { json: () => Promise<unknown> }>

const defaultOption = {
  level: 8,
}

/**
 * @internal
 */
export const __internals: { fetch: FetchLike } = {
  // default fetch
  fetch: async (input: string) => {
    return {
      json: async () => ({}),
    }
  },
}

type NormalizeTownNameOutput = {
  town: string
  town_id: string
  other: string
  lat: string
  lon: string
}
async function normalizeTownName(inputOther: string, pref: string, city: string, fuzzy: boolean): Promise<NormalizeTownNameOutput | undefined> {
  const other = inputOther.trim().replace(/^大字/, '')
  const townPatterns = await getTownRegexPatterns(pref, city)

  const regexPrefixes = ['^']
  if (city.match(/^京都市/)) {
    // 京都は通り名削除のために後方一致を使う
    regexPrefixes.push('.*')
  }

  for (const regexPrefix of regexPrefixes) {
    for (const [town, rawPattern] of townPatterns) {
      let pattern = rawPattern;
      // `pattern` is a regex that will match on `other` string.
      if (fuzzy) {
        // in `other`, there may be a `?` wildcard character that should match any one character.
        pattern = insertWildcardMatching(pattern);
      }
      const regex = new RegExp(`${regexPrefix}${pattern}`)
      const match = other.match(regex)
      if (match) {
        return {
          town: town.originalTown || town.town,
          town_id: town.town_id,
          other: other.substring(match[0].length),
          lat: town.lat,
          lon: town.lon,
        }
      }
    }
  }
}

type NormalizeResidentialPartOutput = {
  blk: string
  blk_id: string
  addr1?: string
  addr1_id?: string
  addr2?: string
  addr2_id?: string
  other: string
  lat: string
  lon: string
}
async function normalizeResidentialPart(
  inputOther: string,
  pref: string,
  city: string,
  town: string,
): Promise<NormalizeResidentialPartOutput | undefined> {
  const [blkList, rsdtList] = await Promise.all([
    getBlkList(pref, city, town),
    getRsdtList(pref, city, town),
  ])

  // 住居表示未整備
  if (blkList.length === 0) {
    return undefined
  }

  const match = inputOther.match(/^([1-9][0-9]*)(?:-([1-9][0-9]*))?(?:-([1-9][0-9]*))?/)
  if (match) {
    const matchedString = match[0];
    const other = inputOther.substring(matchedString.length);

    const blk = match[1]
    const addr1 = match[2]
    const addr2 = match[3]
    const jyukyohyoji = formatResidentialSection({blk, addr1, addr2})
    const residentialWithAddr2 = rsdtList.find(
      (res) => formatResidentialSection(res) === jyukyohyoji,
    )

    if (residentialWithAddr2) {
      return {
        blk,
        blk_id: residentialWithAddr2.blk_id,
        addr1: addr1,
        addr1_id: residentialWithAddr2.addr1_id,
        addr2: addr2 || "",
        addr2_id: residentialWithAddr2.addr2_id,
        other: other.trim(),
        lat: residentialWithAddr2.lat,
        lon: residentialWithAddr2.lon,
      };
    }

    if (addr2) {
      // まずはaddr2を削って再度検索
      const jyukyohyoji = formatResidentialSection({blk, addr1})
      const residential = rsdtList.find(
        (res) => formatResidentialSection(res) === jyukyohyoji,
      )

      if (residential) {
        const otherResult = ((addr2 ? `-${addr2}` : '') + other.replace(/\s+/g, " ")).trim();
        return {
          blk,
          blk_id: residential.blk_id,
          addr1: addr1,
          addr1_id: residential.addr1_id,
          addr2: "",
          addr2_id: "",
          other: otherResult,
          lat: residential.lat,
          lon: residential.lon,
        }
      }
    }

    const singleBlk = blkList.find((item) => item.blk === blk)
    const otherWithUnmatchedAddrs = (addr1 ? `-${addr1}` : '') + (addr2 ? `-${addr2}` : '') + other
    if (singleBlk) {
      return {
        blk,
        blk_id: singleBlk.blk_id,
        other: otherWithUnmatchedAddrs,
        lat: singleBlk.lat,
        lon: singleBlk.lon,
      }
    }
  }

  return undefined
}

export const normalize: Normalizer = async (
  address,
  _option = defaultOption,
) => {
  const option = { ...defaultOption, ..._option }

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
      return zen2han(match)
    })
    // 数字の後または数字の前にくる横棒はハイフンに統一する
    .replace(
      /([0-9０-９一二三四五六七八九〇十百千][-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━])|([-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━])[0-9０-９一二三四五六七八九〇十]/g,
      (match) => {
        return match.replace(/[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]/g, '-')
      },
    )
    .replace(/(.+)(丁目?|番(町|地|丁)|条|軒|線|(の|ノ)町|地割)/, (match) => {
      return match.replace(/ /g, '') // 町丁目名以前のスペースはすべて削除
    })
    .replace(/(.+)((郡.+(町|村))|((市|巿).+(区|區)))/, (match) => {
      return match.replace(/ /g, '') // 区、郡以前のスペースはすべて削除
    })
    .replace(/.+?[0-9一二三四五六七八九〇十百千]-/, (match) => {
      return match.replace(/ /g, '') // 1番はじめに出てくるアラビア数字以前のスペースを削除
    })

  let pref = ''
  let city = ''
  let lg_code: undefined | string
  let town = ''
  let town_id: undefined | string
  let lat = null
  let lon = null
  let level = 0
  let normalized: NormalizeTownNameOutput | NormalizeResidentialPartOutput | undefined

  // 都道府県名の正規化

  const prefectures = await getPrefectures()
  const prefs = Object.keys(prefectures)
  const prefPatterns = getPrefectureRegexPatterns(prefs)
  const sameNamedPrefectureCityRegexPatterns = getSameNamedPrefectureCityRegexPatterns(
    prefs,
    prefectures,
  )

  // 県名が省略されており、かつ市の名前がどこかの都道府県名と同じ場合(例.千葉県千葉市)、
  // あらかじめ県名を補完しておく。
  for (const [prefectureCity, reg] of sameNamedPrefectureCityRegexPatterns) {
    const match = other.match(
      option.fuzzy ? insertWildcardMatching(reg) : reg
    );
    if (match) {
      other = other.replace(new RegExp(reg), prefectureCity)
      break
    }
  }

  for (const [_pref, pattern] of prefPatterns) {
    const match = other.match(
      option.fuzzy ? insertWildcardMatching(pattern) : pattern
    )
    if (match) {
      pref = _pref
      other = other.substring(match[0].length) // 都道府県名以降の住所
      break
    }
  }

  if (!pref) {
    // 都道府県名が省略されている
    const matched: {pref: string, city: SingleCity, other: string}[] = []
    for (const _pref in prefectures) {
      const cities = prefectures[_pref]
      const cityPatterns = getCityRegexPatterns(_pref, cities)

      other = other.trim()
      for (let i = 0; i < cityPatterns.length; i++) {
        const [_city, pattern] = cityPatterns[i]
        const match = other.match(
          option.fuzzy ? insertWildcardMatching(pattern) : pattern
        )
        if (match) {
          matched.push({
            pref: _pref,
            city: _city,
            other: other.substring(match[0].length),
          })
        }
      }
    }

    // マッチする都道府県が複数ある場合は町名まで正規化して都道府県名を判別する。（例: 東京都府中市と広島県府中市など）
    if (1 === matched.length) {
      const matchedCity = matched[0]
      pref = matchedCity.pref
    } else {
      for (const matchedCity of matched) {
        const normalized = await normalizeTownName(
          matchedCity.other,
          matchedCity.pref,
          matchedCity.city.name,
          !!option.fuzzy,
        )
        if (normalized) {
          pref = matchedCity.pref
        }
      }
    }
  }

  if (pref && option.level >= 2) {
    const cities = prefectures[pref]
    const cityPatterns = getCityRegexPatterns(pref, cities)

    other = other.trim()
    for (const [_city, pattern] of cityPatterns) {
      const match = other.match(
        option.fuzzy ? insertWildcardMatching(pattern) : pattern
      )
      if (match) {
        city = _city.name
        lg_code = _city.code
        other = other.substring(match[0].length) // 市区町村名以降の住所
        break
      }
    }
  }

  // 町丁目以降の正規化
  if (city && option.level >= 3) {
    normalized = await normalizeTownName(other, pref, city, !!option.fuzzy)
    if (normalized) {
      town = normalized.town
      town_id = normalized.town_id
      other = normalized.other
      lat = parseFloat(normalized.lat)
      lon = parseFloat(normalized.lon)
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        lat = null
        lon = null
      }
    }

    // townが取得できた場合にのみ、addrに対する各種の変換処理を行う。
    if (town) {
      other = other
        .replace(/^-/, '')
        .replace(/([0-9]+)(丁目)/g, (match) => {
          return match.replace(/([0-9]+)/g, (num) => {
            return number2kanji(Number(num))
          })
        })
        .replace(
          /(([0-9〇一二三四五六七八九十百千]+)(番地?)([0-9〇一二三四五六七八九十百千]+)号)\s*(.+)/,
          '$1 $5',
        )
        .replace(
          /([0-9〇一二三四五六七八九十百千]+)(番地?)([0-9〇一二三四五六七八九十百千]+)号?/,
          '$1-$3',
        )
        .replace(/([0-9〇一二三四五六七八九十百千]+)番地?/, '$1')
        .replace(/([0-9〇一二三四五六七八九十百千]+)の/g, '$1-')
        .replace(
          /([0-9〇一二三四五六七八九十百千]+)[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]/g,
          (match) => {
            return kan2num(match).replace(/[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]/g, '-')
          },
        )
        .replace(
          /[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]([0-9〇一二三四五六七八九十百千]+)/g,
          (match) => {
            return kan2num(match).replace(/[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]/g, '-')
          },
        )
        .replace(/([0-9〇一二三四五六七八九十百千]+)-/, (s) => {
          // `1-` のようなケース
          return kan2num(s)
        })
        .replace(/-([0-9〇一二三四五六七八九十百千]+)/, (s) => {
          // `-1` のようなケース
          return kan2num(s)
        })
        .replace(/-[^0-9]+([0-9〇一二三四五六七八九十百千]+)/, (s) => {
          // `-あ1` のようなケース
          return kan2num(zen2han(s))
        })
        .replace(/([0-9〇一二三四五六七八九十百千]+)$/, (s) => {
          // `串本町串本１２３４` のようなケース
          return kan2num(s)
        })
        .trim()
    }
  }

  other = patchAddr(pref, city, town, other)

  // 住居表示住所リストを使い番地号までの正規化を行う
  if (option.level > 3 && normalized && town) {
    const rsdtNormalized = await normalizeResidentialPart(other, pref, city, town)
    if (rsdtNormalized) {
      other = rsdtNormalized.other;
      normalized = rsdtNormalized;
    }
  }
  if (normalized) {
    lat = parseFloat(normalized.lat)
    lon = parseFloat(normalized.lon)
  }

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    lat = null
    lon = null
  }

  if (pref) level = level + 1
  if (city) level = level + 1
  if (town) level = level + 1

  const result: NormalizeResult = {
    pref,
    city,
    lg_code,
    town,
    town_id,
    other,
    lat,
    lon,
    level,
  }

  if (normalized && 'blk' in normalized) {
    result.addr1 = normalized.addr1
    result.blk = normalized.blk
    result.blk_id = normalized.blk_id
    result.level = 7
  }
  if (normalized && 'addr1' in normalized) {
    result.addr1 = normalized.addr1
    result.addr1_id = normalized.addr1_id
    if ('addr2' in normalized) {
      result.addr2 = normalized.addr2
      result.addr2_id = normalized.addr2_id
    }
    result.level = 8
  }

  return result
}
