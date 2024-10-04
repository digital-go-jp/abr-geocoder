/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { DASH, SPACE } from '@config/constant-values';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { SearchTarget } from '@domain/types/search-target';
import { getLevenshteinDistanceRatio } from '../services/get-levenshtein-distance-ratio';
import { toHankakuAlphaNum } from '../services/to-hankaku-alpha-num';
import { CharNode } from './trie/char-node';
import { AbrGeocoderInput } from './abrg-input-data';

export interface IQuery {
  // ファイルから入力された住所（最後まで変更しない）
  input: QueryInput;

  // 作業用の変数
  tempAddress?: CharNode;

  // 全体として何文字マッチしたのか
  matchedCnt: number;

  startTime: number;
  fuzzy?: string;
  searchTarget: SearchTarget;

  pref?: string;
  pref_key?: number;
  city_key?: number;
  town_key?: number;
  machiaza_id?: string;
  rsdtblk_key?: number;
  rsdtdsp_key?: number;
  rsdt_addr_flg?: number;
  koaza_aka_code?: number;

  county?: string;
  city?: string;
  ward?: string;
  
  oaza_cho?: string;
  chome?: string;
  koaza?: string;

  lg_code?: string;
  rep_lat: number | null;
  rep_lon: number | null;

  block?: string;
  block_id?: string;

  rsdt_num?: number;
  rsdt_id?: string;
  rsdt_num2?: number;
  rsdt2_id?: string;
  
  prc_num1?: string;
  prc_num2?: string;
  prc_num3?: string;
  prc_id?: string;
  parcel_key?: number;

  // 文字列として、どのレベルまでマッチしたか
  match_level: MatchLevel;
  // 緯度経度が有効なレベル
  coordinate_level: MatchLevel;

  // FuzzyやextraChallenge を何文字含むか
  ambiguousCnt: number;
}
export type QueryInput = {
  data: AbrGeocoderInput;
  // worker-thread-poolのtaskId
  taskId: number;
};

export type FormattedAddres = {
  address: string;
  score: number;
};
export type QueryJson = Omit<IQuery, 'tempAddress'> & { tempAddress: string | undefined; };

export class Query implements IQuery {
  public readonly input: QueryInput;
  public readonly tempAddress?: CharNode;
  public readonly searchTarget: SearchTarget;
  public readonly fuzzy?: string;
  public readonly other?: string;
  public readonly pref?: string;
  public readonly pref_key?: number;
  public readonly county?: string;
  public readonly city?: string;
  public readonly city_key?: number;
  public readonly ward?: string;
  public readonly oaza_cho?: string;
  public readonly chome?: string;
  public readonly koaza?: string;
  public readonly town_key?: number;
  public readonly rsdtblk_key?: number;
  public readonly rsdtdsp_key?: number;
  public readonly parcel_key?: number;
  public readonly lg_code?: string;
  public readonly rep_lat: number | null;
  public readonly rep_lon: number | null;
  public readonly block?: string;
  public readonly block_id?: string;
  public readonly machiaza_id?: string;
  public readonly rsdt_num?: number;
  public readonly rsdt_id?: string;
  public readonly rsdt_num2?: number;
  public readonly rsdt2_id?: string;
  public readonly prc_num1?: string;
  public readonly prc_num2?: string;
  public readonly prc_num3?: string;
  public readonly prc_id?: string;
  public readonly rsdt_addr_flg?: number;
  public readonly koaza_aka_code?: number;
  public readonly match_level: MatchLevel;
  public readonly coordinate_level: MatchLevel;
  public readonly matchedCnt: number = 0;
  public readonly ambiguousCnt: number = 0;
  public readonly formatted: FormattedAddres;
  public readonly debug: {
    original?: string;
    processed?: string;
  };
  public readonly startTime: number = 0;

  private constructor(params: IQuery) {
    this.fuzzy = params.fuzzy;
    this.searchTarget = params.searchTarget;
    this.pref_key = params.pref_key;
    this.city_key = params.city_key;
    this.town_key = params.town_key;
    this.rsdtblk_key = params.rsdtblk_key;
    this.rsdtdsp_key = params.rsdtdsp_key;
    this.match_level = params.match_level;
    this.coordinate_level = params.coordinate_level;
    this.matchedCnt = params.matchedCnt;
    this.ambiguousCnt = params.ambiguousCnt;
    this.startTime = params.startTime;

    this.input = params.input;
    this.tempAddress = params.tempAddress;
    this.pref = params.pref;
    this.county = params.county;
    this.city = params.city;
    this.ward = params.ward;
    this.oaza_cho = params.oaza_cho;
    this.chome = params.chome;
    this.koaza = params.koaza;
    this.lg_code = params.lg_code;

    this.block = params.block;
    this.block_id = params.block_id;
    
    this.rep_lat = params.rep_lat;
    this.rep_lon = params.rep_lon;
    this.rsdt_addr_flg = params.rsdt_addr_flg;
    this.koaza_aka_code = params.koaza_aka_code;
    this.rsdt_num = params.rsdt_num;
    this.rsdt_id = params.rsdt_id;
    this.rsdt_num2 = params.rsdt_num2;
    this.rsdt2_id = params.rsdt2_id;
    this.prc_num1 = params.prc_num1;
    this.prc_num2 = params.prc_num2;
    this.prc_num3 = params.prc_num3;
    this.prc_id = params.prc_id;
    this.parcel_key = params.parcel_key;
    this.machiaza_id = params.machiaza_id;
    this.debug = {
      original: this.tempAddress?.toOriginalString(),
      processed: this.tempAddress?.toProcessedString(),
    };

    this.formatted = this.getFormattedAddress();
    Object.freeze(this);
  }

  public toJSON(): QueryJson {
    return {
      ambiguousCnt: this.ambiguousCnt,
      fuzzy: this.fuzzy,
      searchTarget: this.searchTarget,
      city_key: this.city_key as number || undefined,
      pref_key: this.pref_key as number || undefined,
      town_key: this.town_key as number || undefined,
      rsdtblk_key: this.rsdtblk_key,
      rsdtdsp_key: this.rsdtdsp_key,
      matchedCnt: this.matchedCnt,
      startTime: this.startTime,
      input: this.input,
      tempAddress: this.tempAddress?.toString(),
      pref: this.pref as string || undefined,
      county: this.county as string || undefined,
      city: this.city as string || undefined,
      ward: this.ward as string || undefined,
      oaza_cho: this.oaza_cho,
      chome: this.chome,
      koaza: this.koaza,
      lg_code: this.lg_code as string || undefined,
      rep_lat: this.rep_lat as number || null,
      rep_lon: this.rep_lon as number || null,
      rsdt_addr_flg: this.rsdt_addr_flg,
      koaza_aka_code: this.koaza_aka_code,
      machiaza_id: this.machiaza_id as string,
      block: this.block,
      block_id: this.block_id,
      rsdt_num: this.rsdt_num,
      rsdt_id: this.rsdt_id,
      rsdt_num2: this.rsdt_num2,
      rsdt2_id: this.rsdt2_id,
      prc_id: this.prc_id,
      prc_num1: this.prc_num1,
      prc_num2: this.prc_num2,
      prc_num3: this.prc_num3,
      parcel_key: this.parcel_key,
      match_level: {
        str: this.match_level.str,
        num: this.match_level.num,
      },
      coordinate_level: {
        str: this.coordinate_level.str,
        num: this.coordinate_level.num,
      },
    };
  }

  public copy(newValues: Partial<IQuery>): Query {
    if ('rep_lat' in newValues || 'rep_lon' in newValues) {
      if (!newValues.rep_lat || !newValues.rep_lon) {
        delete newValues.rep_lat;
        delete newValues.rep_lon;
        delete newValues.coordinate_level;
      }
    }
    return new Query(
      Object.assign(
        {
          ambiguousCnt: this.ambiguousCnt,
          fuzzy: this.fuzzy,
          searchTarget: this.searchTarget,

          pref_key : this.pref_key,
          city_key : this.city_key,
          town_key : this.town_key,
          rsdtblk_key : this.rsdtblk_key,
          rsdtdsp_key : this.rsdtdsp_key,
          parcel_key : this.parcel_key,

          startTime: this.startTime,
          matchedCnt: this.matchedCnt,
          tempAddress : this.tempAddress,
          pref : this.pref,
          county : this.county,
          city : this.city,
          ward : this.ward,
          oaza_cho : this.oaza_cho,
          chome : this.chome,
          koaza : this.koaza,
          lg_code : this.lg_code,
          block : this.block,
          block_id : this.block_id,
          rsdt_num : this.rsdt_num,
          rsdt_id : this.rsdt_id,
          rsdt_num2 : this.rsdt_num2,
          rsdt2_id : this.rsdt2_id,
          rep_lat : this.rep_lat,
          rep_lon : this.rep_lon,
          rsdt_addr_flg : this.rsdt_addr_flg,
          koaza_aka_code : this.koaza_aka_code,
          machiaza_id : this.machiaza_id,
          prc_num1 : this.prc_num1,
          prc_num2 : this.prc_num2,
          prc_num3 : this.prc_num3,
          prc_id : this.prc_id,
          match_level : this.match_level,
          coordinate_level : this.coordinate_level,
        },
        newValues || {},
        {
          input : this.input,
        },
      ),
    );
  }

  private eliminateEmptyElement(strList: (string | undefined)[]): string[] {
    return strList.filter(value => value !== undefined && value !== '') as string[];
  }

  //
  // formatted_address を生成する
  //
  private getFormattedAddress(): FormattedAddres {
    const formatted_address: string[] = [];
    const addressComponents = this.eliminateEmptyElement([
      this.pref?.trim(),
      this.county?.trim(),
      this.city?.trim(),
      this.ward?.trim(),
    ]).join('');
    formatted_address.push(addressComponents);

    if (this.koaza_aka_code === 2) {
      // 京都の通り名の場合、(小字 = 通り名)(大字) になっている
      formatted_address.push(
        this.eliminateEmptyElement([
          this.koaza?.trim(),
          this.oaza_cho?.trim(),
        ]).join(''),
      );
    } else {
      // 通常は (大字)(丁目)(小字) の順になっている
      formatted_address.push(
        this.eliminateEmptyElement([
          this.oaza_cho?.trim(),
          this.chome?.trim(),
          this.koaza?.trim(),
        ]).join(''),
      );
    }

    if (this.match_level.num === MatchLevel.PARCEL.num) {
      // 地番表記
      const parcelNums = [];
      for (const prc_num of [
        this.prc_num1,
        this.prc_num2,
        this.prc_num3,
      ]) {
        if (!prc_num) {
          break;
        }
        parcelNums.push(prc_num);
      }
      formatted_address.push(parcelNums.join('-'));
    } else {
      // 住居番号の街区・番地
      const residentialNums = this.eliminateEmptyElement([
        this.block?.toString().trim(),
        this.rsdt_num?.toString().trim(),
        this.rsdt_num2?.toString().trim(),
      ]).join('-');
      formatted_address.push(residentialNums);
    }

    if (this.tempAddress) {
      const other = this.tempAddress?.toOriginalString()?.trim() || undefined;
      if (other) {
        if (!RegExpEx.create(`[号番通条町街丁階線F${DASH}${SPACE}]`).test(formatted_address.at(-1) || '')) {
          const isTailDigit = RegExpEx.create('[0-9]').test(formatted_address.at(-1) || '');
          const isHeadDigit = RegExpEx.create('[0-9]').test(other[0]);
          const isHeadDash = other[0] === '-';
          if (
            // 末尾が数字 で otherの始まりも数字の場合、 1 234号室などなので、スペースを入れる
            (isTailDigit && isHeadDigit) ||
            // 末尾が数字 で otherの始まりはDASHではない場合、 1 234号室などなので、スペースを入れる
            (isTailDigit && !isHeadDash)
          ) {
            // formatted_address.push('✅');
            formatted_address.push(' ');
          }
        }

        // "123どこかのビル” のようになっているとき、"123" と "どこかのビル"の間にスペースを入れる
        // if (RegExpEx.create(`^([0-9]+)(?![号番通条町街丁階線F \-])`).test(other)) {
        //   other = other.replace(RegExpEx.create(`^([0-9]+)((?![号番通条町街丁階線F \-]))`, 'g'), '$1 $2');
        // }
        if (other) {
          formatted_address.push(other);
        }
      }
    }

    // 最終的な文字列を作成
    const result = formatted_address.join('')
      .replaceAll(RegExpEx.create(' +', 'g'), ' ')
      .replace(RegExpEx.create('丁目-([0-9])', 'g'), '丁目$1')  
      .trim();
    
    // 最終的な文字列と一番最初のクエリ文字列の類似度を計算する
    const originalInput = this.input.data.address.replaceAll(RegExpEx.create('[ 　]+', 'g'), ' ');
    const score = getLevenshteinDistanceRatio(
      toHankakuAlphaNum(result),
      toHankakuAlphaNum(originalInput),
    );

    return {
      address: result,
      score,
    };
  }

  static readonly from = (params: Omit<IQuery, 'tempAddress'> & { tempAddress: string | undefined; } ): Query => {
    if (params.match_level === undefined) {
      params.match_level = MatchLevel.UNKNOWN;
    }
    if (params.tempAddress) {
      const tempAddress = params.tempAddress;
      delete params.tempAddress;
      return new Query({
        ...params,
        tempAddress: CharNode.fromString(tempAddress),
      });
    } else {
      return new Query(params as Omit<IQuery, 'tempAddress'> & { tempAddress: undefined });
    }
  };

  static readonly create = (input: QueryInput): Query => {
    input.data.address = input.data.address.trim();

    // 1文字ずつを連結リストに変換する
    // 内部で漢数字を半角数字に変換したりすることで、
    // 固有名詞に漢数字が含まれていたりすると、元の漢数字を取り出せなくなるため。
    const tempAddress = CharNode.create(input.data.address);

    return new Query({
      input,
      tempAddress,
      rep_lat: null,
      rep_lon: null,
      matchedCnt: 0,
      match_level: MatchLevel.UNKNOWN,
      coordinate_level: MatchLevel.UNKNOWN,
      startTime: Date.now(),
      fuzzy: input.data.fuzzy,
      searchTarget: input.data.searchTarget,
      ambiguousCnt: 0,
    });
  };
}
