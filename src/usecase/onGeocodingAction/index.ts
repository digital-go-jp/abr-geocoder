export * from './getReadStreamFromSource';
export * from './types';

import { Database } from 'better-sqlite3';
import byline from 'byline';
import { Stream } from 'node:stream';
import { container } from 'tsyringe';
import PATCH_PATTERNS from '../../settings/patchPatterns';
import { RegExpEx } from '../../domain';
import {
  setupContainer,
  setupContainerForTest,
  setupContainerParams,
} from '../../interface-adapter';
import { AddressFinderForStep3and5 } from './AddressFinderForStep3and5';
import { AddressFinderForStep7 } from './AddressFinderForStep7';
import { getCityPatternsForEachPrefecture } from './getCityPatternsForEachPrefecture';
import { getPrefectureRegexPatterns } from './getPrefectureRegexPatterns';
import { getPrefecturesFromDB } from './getPrefecturesFromDB';
import { getReadStreamFromSource } from './getReadStreamFromSource';
import { getSameNamedPrefecturePatterns } from './getSameNamedPrefecturePatterns';
import {
  NormalizeStep1,
  NormalizeStep2,
  NormalizeStep3,
  NormalizeStep3Final,
  NormalizeStep3a,
  NormalizeStep3b,
  NormalizeStep4,
  NormalizeStep5,
  NormalizeStep6,
  NormalizeStep7,
} from './steps';
import { Query } from './query.class';
import { GeocodingParams, IAddressPatch, IPrefecture, InterpolatePattern, PrefectureName } from './types';

export namespace geocodingAction {
  let initialized = false;

  export async function init(params: setupContainerParams) {
    if (initialized) {
      throw new Error('Already initialized');
    }
    initialized = true;
    await setupContainer(params);
  }

  export async function initForTest(params: setupContainerParams) {
    if (initialized) {
      throw new Error('Already initialized');
    }
    initialized = true;
    await setupContainerForTest(params);
  }

  export const start = async ({
    source,
    destination,
    dataDir,
    resourceId,
    format,
    fuzzy,
  }: GeocodingParams) => {
    const lineStream = byline.createStream();

    const db: Database = container.resolve('Database');

    const convertToQuery = new Stream.Transform({
      objectMode: true,
      transform(line: Buffer, encoding, callback) {
        const input = line.toString();

        // コメント行は無視する
        if (input.startsWith('#') || input.startsWith('//')) {
          callback();
          return;
        }

        // 入力値を最後までキープするため、Queryクラスでラップする
        callback(null, Query.create(input));
      },
    });

    /**
     * 都道府県とそれに続く都市名を取得する
     */
    const prefectures: IPrefecture[] = await getPrefecturesFromDB({
      db,
    });

    /**
     * string = "^愛知郡愛荘町" を  "^(愛|\\?)(知|\\?)(郡|\\?)(愛|\\?)(荘|\\?)(町|\\?)" にする
     */
    const insertWildcardMatching = (string: string) => {
      return string.replace(
        RegExpEx.create('(?<!\\[[^\\]]*)([一-龯ぁ-んァ-ン])(?!\\?)', 'g'),
        '($1|\\?)'
      );
    };
    const passThrough = (pattern: string) => pattern;
    const wildcardHelper = fuzzy ? insertWildcardMatching : passThrough;

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
    // 例： ('＿' は全角スペース, @ は constantValues.DASH の文字)
    // 東京都千代田区紀尾井町1-3'＿'東京ガーデンテラス紀尾井町 19階、20階 => 東京都千代田区紀尾井町1@3 東京ガーデンテラス紀尾井町 19階、20階
    const normalizeStep1 = new NormalizeStep1();

    // 特定のパターンから都道府県名が判別できるか試みる
    //
    // 以下のような形になる (@ は constantValues.DASH の文字)
    // Query {
    //   input: '東京都千代田区紀尾井町1ー3　東京ガーデンテラス紀尾井町 19階、20階',
    //   tempAddress: '千代田区紀尾井町1@3 東京ガーデンテラス紀尾井町 19階、20階',
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
    const normalizeStep2 = new NormalizeStep2({
      prefPatterns,
      sameNamedPrefPatterns,
    });

    // step3はデータベースを使って都道府県と市町村を特定するため、処理が複雑になる
    // なので、さらに別のストリームで処理を行う
    const addressFinderForStep5 = new AddressFinderForStep3and5({
      db,
      wildcardHelper,
    });

    const step3a_stream = new NormalizeStep3a(cityPatternsForEachPrefecture);
    const step3b_stream = new NormalizeStep3b(addressFinderForStep5);
    const step3final_stream = new NormalizeStep3Final();
    step3a_stream.pipe(step3b_stream).pipe(step3final_stream);

    const normalizeStep3 = new NormalizeStep3(step3a_stream);

    // step2でprefectureが判定できている場合はstep3で判定しないので
    // この時点で判定できていないケースの city を判定している
    //
    // Query {
    //   input: '東京都千代田区紀尾井町1ー3　東京ガーデンテラス紀尾井町 19階、20階',
    //   tempAddress: '紀尾井町1@3 東京ガーデンテラス紀尾井町 19階、20階',
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
    const normalizeStep4 = new NormalizeStep4({
      cityPatternsForEachPrefecture,
      wildcardHelper,
    });

    // もう一度データベースを探して、情報を追加
    // (step3bを通過しないデータもあるから、このステップで追加しているように思う)
    const normalizeStep5 = new NormalizeStep5(addressFinderForStep5);

    // TypeScript が prefecture の string型 を PrefectureName に変換できないので、
    // ここで変換する
    const prefectureSet = new Set<string>();
    Object.values(PrefectureName).forEach(pref => {
      prefectureSet.add(pref);
    })
    const patchValues = PATCH_PATTERNS
      .filter(pref => prefectureSet.has(pref.prefecture))
      .map<IAddressPatch>(patch => {
        return {
          ...patch,
          prefecture: patch.prefecture as PrefectureName,
        }
      });
    
    // アドレスの補正処理
    // おそらくうまく処理出来ないケースをここで修正している
    const normalizeStep6 = new NormalizeStep6(patchValues);

    // アドレスの補正処理らしいことをしている
    const addressFinderForStep7 = new AddressFinderForStep7(db);
    const normalizeStep7 = new NormalizeStep7(addressFinderForStep7);

    getReadStreamFromSource(source)
      .pipe(lineStream)
      .pipe(convertToQuery)
      .pipe(normalizeStep1)
      .pipe(normalizeStep2)
      .pipe(normalizeStep3)
      .pipe(normalizeStep4)
      .pipe(normalizeStep5)
      .pipe(normalizeStep6)
      .pipe(normalizeStep7)
      .pipe(
        new Stream.Writable({
          objectMode: true,
          write(chunk, encoding, callback) {
            console.debug('--->final', chunk);
            callback();
          },
        })
      )
      //     .pipe(
      //       new Stream.Writable({
      //         objectMode: true,
      //         write(chunk, encoding, callback) {
      //           console.log(chunk.toString());
      //           callback();
      //         },
      //       })
      //     )
      .on('end', () => {
        db.close();
      });
  };
}

export const onGeocodingAction = async (params: GeocodingParams) => {
  await geocodingAction.init({
    dataDir: params.dataDir,
    ckanId: params.resourceId,
  });
  await geocodingAction.start(params);
};
