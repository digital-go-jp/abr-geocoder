export * from './getReadStreamFromSource';
export * from './types';

import { Database } from 'better-sqlite3';
import byline from 'byline';
import { Stream } from 'node:stream';
import { container } from 'tsyringe';
import {
  setupContainer,
  setupContainerForTest,
  setupContainerParams,
} from '../../interface-adapter';
import { getReadStreamFromSource } from './getReadStreamFromSource';
import { FromStep3Type, GeocodingParams, INormalizedCity, IPrefecture, ITown, InterpolatePattern, Prefecture, PrefectureName, getNormalizedCityParams } from './types';
import { getPrefecturesFromDB } from './getPrefecturesFromDB';
import { getPrefectureRegexPatterns } from './getPrefectureRegexPatterns';
import { getSameNamedPrefecturePatterns } from './getSameNamedPrefecturePatterns';
import { DataField, RegExpEx } from '../../domain';
import { findKanjiNumbers } from '@geolonia/japanese-numeral'
import { toRegexPattern } from './toRegexPattern';
import { NormalizeStep1, NormalizeStep2, NormalizeStep3, NormalizeStep3a, NormalizeStep3b } from './normalize';
import { Query } from './query.class';
import { DASH_SYMBOLS } from '../../domain/constantValues';
import { getCityPatternsForEachPrefecture } from './getCityPatternsForEachPrefecture';
import { AddressFinder } from './AddressFinder';

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
    // const logger: Logger = container.resolve('Logger');
    // const progressBar = container.resolve<SingleBar>('DownloadProgressBar');


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
    })

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
        RegExpEx.create('(?<!\\\[[^\\\]]*)([一-龯ぁ-んァ-ン])(?!\\\?)', 'g'),
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
    const sameNamedPrefPatterns: InterpolatePattern[] = getSameNamedPrefecturePatterns({
      prefectures,
      wildcardHelper,
    });

    /**
     * 各都道府県別に市町村で始まるパターンを生成する
     */
    const cityPatternsForEachPrefecture = getCityPatternsForEachPrefecture(prefectures);


    const citiesByPrefectures: Record<string, IPrefecture> = {};
    prefectures.forEach((pref) => {
      citiesByPrefectures[pref.name] = pref;
    });

    const normalizeStep1 = new NormalizeStep1();
    const normalizeStep2 = new NormalizeStep2(sameNamedPrefPatterns);

    const step3stream = new Stream.Readable({
      objectMode: true,
    });
    const step3astream = new NormalizeStep3a(cityPatternsForEachPrefecture);

    const addressFinder = new AddressFinder({
      db,
      wildcardHelper,
    });

    const step3bstream = new NormalizeStep3b(addressFinder);
    step3stream.pipe(step3astream)
      .pipe(new Stream.Writable({
        objectMode: true,
        write(chunk: FromStep3Type, encoding, callback) {
          callback();
          chunk.callback(null, chunk.query);
        },
      }))
    const normalizeStep3 = new NormalizeStep3(step3stream);

    getReadStreamFromSource(source)
      .pipe(lineStream)
      .pipe(convertToQuery)
      .pipe(normalizeStep1)
      .pipe(normalizeStep2)
      .pipe(normalizeStep3)
      .pipe(new Stream.Writable({
        objectMode: true,
        write(chunk, encoding, callback) {
          console.debug(chunk);
          callback();
        },
      }))
  //     .pipe(
  //       new Stream.Writable({
  //         objectMode: true,
  //         write(chunk, encoding, callback) {
  //           console.log(chunk.toString());
  //           callback();
  //         },
  //       })
  //     )
  //     .on('end', () => {
  //       db.close();
  //     });
  };
}

export const onGeocodingAction = async (params: GeocodingParams) => {
  await geocodingAction.init({
    dataDir: params.dataDir,
    ckanId: params.resourceId,
  });
  await geocodingAction.start(params);
};

