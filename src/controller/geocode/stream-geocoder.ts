/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
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
import { GeocodeResult } from '@domain/geocode-result';
import { getCityPatternsForEachPrefecture } from '@domain/geocode/get-city-patterns-for-each-prefecture';
import { getPrefectureRegexPatterns } from '@domain/geocode/get-prefecture-regex-patterns';
import { getPrefecturesFromDB } from '@domain/geocode/get-prefectures-from-db';
import { getSameNamedPrefecturePatterns } from '@domain/geocode/get-same-named-prefecture-patterns';
import { IAddressPatch } from '@domain/iaddress-patch';
import { InterpolatePattern } from '@domain/interpolate-pattern';
import { IPrefecture } from '@domain/prefecture';
import { PrefectureName } from '@domain/prefecture-name';
import { Query } from '@domain/query';
import { RegExpEx } from '@domain/reg-exp-ex';
import PATCH_PATTERNS from '@settings/patch-patterns';
import { AddressFinderForStep3and5 } from '@usecase/geocode/address-finder-for-step3and5';
import { AddressFinderForStep7 } from '@usecase/geocode/address-finder-for-step7';
import { Database } from 'better-sqlite3';
import { Readable, Transform, Writable } from 'node:stream';
import { TransformCallback } from 'stream';
import { GeocodingStep1 } from './step1-transform';
import { GeocodingStep2 } from './step2-transform';
import { GeocodingStep3 } from './step3-transform';
import { GeocodingStep3A } from './step3a-transform';
import { GeocodingStep3B } from './step3b-transform';
import { GeocodingStep3Final } from './step3final-transform';
import { GeocodingStep4 } from './step4-transform';
import { GeocodingStep5 } from './step5-transform';
import { GeocodingStep6 } from './step6-transform';
import { GeocodingStep7 } from './step7-transform';
import { GeocodingStep8 } from './step8-transform';

export class StreamGeocoder extends Transform {
  private constructor(private stream: Readable) {
    super({
      objectMode: true,
    });
  }

  _transform(
    line: Buffer,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    const input = line.toString().trim();

    // コメント行と空行は無視する
    if (input.startsWith('#') || input.startsWith('//') || input === '') {
      callback();
      return;
    }

    // 入力値を最後までキープするため、Queryクラスでラップする
    this.stream.push(Query.create(input, callback));
  }

  static readonly create = async (
    database: Database,
    fuzzy?: string
  ): Promise<StreamGeocoder> => {
    /**
     * 都道府県とそれに続く都市名を取得する
     */
    const prefectures: IPrefecture[] = await getPrefecturesFromDB({
      db: database,
    });

    /**
     * string = "^愛知郡愛荘町" を  "^(愛|\\?)(知|\\?)(郡|\\?)(愛|\\?)(荘|\\?)(町|\\?)" にする
     */
    const insertWildcardMatching = (string: string) => {
      return string.replace(
        RegExpEx.create(
          `(?<!\\[[^\\]]*)([一-龯ぁ-んァ-ン])(?!\\${fuzzy})`,
          'g'
        ),
        `($1|\\${fuzzy})`
      );
    };
    const passThrough = (pattern: string) => pattern;
    const wildcardHelper =
      fuzzy !== undefined && fuzzy !== null && fuzzy !== ''
        ? insertWildcardMatching
        : passThrough;

    /**
     * regexpPattern = ^東京都? を作成する
     */
    const prefPatterns: InterpolatePattern[] = getPrefectureRegexPatterns({
      prefectures,
      wildcardHelper,
    });

    /**
     * 「福島県石川郡石川町」のように、市の名前が別の都道府県名から
     *  始まっているケースのための正規表現パターンを生成する
     */
    const sameNamedPrefPatterns: InterpolatePattern[] =
      getSameNamedPrefecturePatterns({
        prefectures,
        wildcardHelper,
      });

    /**
     * 各都道府県別に市町村で始まるパターンを生成する
     */
    const cityPatternsForEachPrefecture =
      getCityPatternsForEachPrefecture(prefectures);

    // 住所の正規化処理
    //
    // 例：
    //
    // 東京都千代田区紀尾井町1ー3 東京ガーデンテラス紀尾井町 19階、20階
    //  ↓
    // 東京都千代田区紀尾井町1{DASH}3{SPACE}東京ガーデンテラス紀尾井町{SPACE}19階、20階
    //
    const step1 = new GeocodingStep1();

    /* eslint-disable no-irregular-whitespace */
    // 特定のパターンから都道府県名が判別できるか試みる
    //
    // 以下のような形になる
    // Query {
    //   input: '東京都千代田区紀尾井町1ー3　東京ガーデンテラス紀尾井町 19階、20階',
    //   tempAddress: '千代田区紀尾井町1{DASH}3{SPACE}東京ガーデンテラス紀尾井町{SPACE}19階、20階',
    //   prefecture: '東京都',
    //   city: undefined,
    //   town: undefined,
    //   town_id: undefined,
    //   lg_code: undefined,
    //   lat: null,
    //   lon: null,
    //   block: undefined,
    //   block_id: undefined,
    //   addr1: undefined,
    //   addr1_id: undefined,
    //   addr2: undefined,
    //   addr2_id: undefined
    // }
    /* eslint-enable no-irregular-whitespace */
    const step2 = new GeocodingStep2({
      prefPatterns,
      sameNamedPrefPatterns,
    });

    // step3はデータベースを使って都道府県と市町村を特定するため、処理が複雑になる
    // なので、さらに別のストリームで処理を行う
    const addressFinderForStep3and5 = new AddressFinderForStep3and5({
      db: database,
      wildcardHelper,
    });

    const step3other_stream = new Readable({
      read() {},
      objectMode: true,
    });
    const step3a_stream = new GeocodingStep3A(cityPatternsForEachPrefecture);
    const step3b_stream = new GeocodingStep3B(addressFinderForStep3and5);
    const step3final_stream = new GeocodingStep3Final();
    step3other_stream
      .pipe(step3a_stream)
      .pipe(step3b_stream)
      .pipe(step3final_stream);

    /* eslint-disable no-irregular-whitespace */
    // 都道府県名がstep2で判別出来ない場合、step3が実行される
    //
    // 以下のような形になる
    // Query {{
    //   input: '千代田区紀尾井町1ー3　東京ガーデンテラス紀尾井町 19階、20階',
    //   tempAddress: '紀尾井町1{DASH}3{SPACE}東京ガーデンテラス紀尾井町{SPACE}19階、20階',
    //   prefecture: '東京都',
    //   city: '千代田区',
    //   town: undefined,
    //   town_id: undefined,
    //   lg_code: undefined,
    //   lat: null,
    //   lon: null,
    //   block: undefined,
    //   block_id: undefined,
    //   addr1: undefined,
    //   addr1_id: undefined,
    //   addr2: undefined,
    //   addr2_id: undefined
    // }
    /* eslint-enable no-irregular-whitespace */
    const step3 = new GeocodingStep3(step3other_stream);

    /* eslint-disable no-irregular-whitespace */
    // step2で都道府県名が判定できている場合、step3で判定しないので
    // この時点で判定できていないケースの city を判定している
    //
    // 以下のような形になる
    // Query {
    //   input: '東京都千代田区紀尾井町1ー3　東京ガーデンテラス紀尾井町 19階、20階',
    //   tempAddress: '紀尾井町1{DASH}3{SPACE}東京ガーデンテラス紀尾井町{SPACE}19階、20階',
    //   prefecture: '東京都',
    //   city: '千代田区',
    //   town: undefined,
    //   town_id: undefined,
    //   lg_code: undefined,
    //   lat: null,
    //   lon: null,
    //   block: undefined,
    //   block_id: undefined,
    //   addr1: undefined,
    //   addr1_id: undefined,
    //   addr2: undefined,
    //   addr2_id: undefined
    // }
    /* eslint-enable no-irregular-whitespace */
    const step4 = new GeocodingStep4({
      cityPatternsForEachPrefecture,
      wildcardHelper,
    });

    /* eslint-disable no-irregular-whitespace */
    // 詳細な情報を追加する。
    // 以下のような形になる
    //
    // Query {
    //   input: '東京都千代田区紀尾井町1ー3　東京ガーデンテラス紀尾井町 19階、20階',
    //   tempAddress: '1{DASH}3{SPACE}東京ガーデンテラス紀尾井町{SPACE}19階、20階',
    //   prefecture: '東京都',
    //   city: '千代田区',
    //   town: '紀尾井町',
    //   town_id: '0056000',
    //   lg_code: '131016',
    //   lat: 35.681411,
    //   lon: 139.73495,
    //   block: undefined,
    //   block_id: undefined,
    //   addr1: undefined,
    //   addr1_id: undefined,
    //   addr2: undefined,
    //   addr2_id: undefined
    // }
    /* eslint-enable no-irregular-whitespace */
    const step5 = new GeocodingStep5(addressFinderForStep3and5);

    // TypeScript が prefecture の string型 を PrefectureName に変換できないので、
    // ここで変換する
    const prefectureSet = new Set<string>();
    Object.values(PrefectureName).forEach(pref => {
      prefectureSet.add(pref);
    });
    const patchValues = PATCH_PATTERNS.filter(pref =>
      prefectureSet.has(pref.prefecture)
    ).map<IAddressPatch>(patch => {
      return {
        ...patch,
        prefecture: patch.prefecture as PrefectureName,
      };
    });

    // アドレスの補正処理
    // うまく処理出来ないケースをここで修正している
    const step6 = new GeocodingStep6(patchValues);

    /* eslint-disable no-irregular-whitespace */
    //
    // 最終的なデータを取得する
    //
    // Query {
    //   input: '東京都千代田区紀尾井町1ー3　東京ガーデンテラス紀尾井町 19階、20階',
    //   tempAddress: '{SPACE}東京ガーデンテラス紀尾井町{SPACE}19階、20階',
    //   prefecture: '東京都',
    //   city: '千代田区',
    //   town: '紀尾井町',
    //   town_id: '0056000',
    //   lg_code: '131016',
    //   lat: 35.681411,  <-- blkの緯度経度が取れる場合は、それを利用する（誤差が大きい）
    //   lon: 139.73495,  <-- 取れない場合はtownの緯度経度を利用する（誤差が少ない）
    //   block: '1',
    //   block_id: '001',
    //   addr1: '3',
    //   addr1_id: '003',
    //   addr2: '',
    //   addr2_id: ''
    // }
    //
    /* eslint-enable no-irregular-whitespace */
    const addressFinderForStep7 = new AddressFinderForStep7({
      db: database,
      fuzzy,
    });
    const step7 = new GeocodingStep7(addressFinderForStep7);

    // {SPACE} と {DASH} をもとに戻す
    const step8 = new GeocodingStep8();

    const processStream = new Readable({
      read() {},
      objectMode: true,
    });
    processStream
      .pipe(step1)
      .pipe(step2)
      .pipe(step3)
      .pipe(step4)
      .pipe(step5)
      .pipe(step6)
      .pipe(step7)
      .pipe(step8)
      .pipe(
        new Writable({
          objectMode: true,
          write(query: Query, encoding, callback) {
            callback();
            if (!query.next) {
              return;
            }

            query.next(
              null,
              GeocodeResult.create({
                input: query.input,
                match_level: query.match_level,
                lat: query.lat,
                lon: query.lon,
                other: query.tempAddress,
                prefecture: query.prefecture,
                city: query.city,
                town: query.town,
                town_id: query.town_id,
                lg_code: query.lg_code,
                block: query.block,
                block_id: query.block_id,
                addr1: query.addr1,
                addr1_id: query.addr1_id,
                addr2: query.addr2,
                addr2_id: query.addr2_id,
              })
            );
          },
        })
      );

    return new StreamGeocoder(processStream);
  };
}
