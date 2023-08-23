export * from './JPAddressNormalizer';
export * from './getReadStreamFromSource';
export * from './types';

import {Database} from 'better-sqlite3';
import byline from 'byline';
import {Stream} from 'node:stream';
import {container} from 'tsyringe';
import {
  setupContainer,
  setupContainerForTest,
  setupContainerParams,
} from '../../interface-adapter';
import {JPAddressNormalizer} from './JPAddressNormalizer';
import {getPrefectureRegexPatterns} from './getPrefectureRegexPatterns';
import {getPrefecturesFromDB} from './getPrefecturesFromDB';
import {getReadStreamFromSource} from './getReadStreamFromSource';
import {getSameNamedPrefecturePatterns} from './getSameNamedPrefecturePatterns';
import {GeocodingParams} from './types';

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

    const convertToHankaku = (str: string) => {
      return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => {
        return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
      });
    };

    // 都道府県名の正規化
    const prefectures = await getPrefecturesFromDB({
      db,
    });
    const prefPatterns = getPrefectureRegexPatterns();
    const sameNamedPrefPatterns = getSameNamedPrefecturePatterns({
      prefPatterns,
      prefectures,
    });

    // // 入力された住所を正規化する
    const normalizer = new JPAddressNormalizer({
      convertToHankaku,

      // 住所が不完全なときに補正する正規表現パターン
      //
      // TODO: 全部前方一致の正規表現パターンなので、O(M * N)になる。
      // 遅いようなら、トライ木に置き換える
      specialPatterns: [...sameNamedPrefPatterns, ...prefPatterns],

      // 曖昧検索
      fuzzy,
    });

    getReadStreamFromSource(source)
      .pipe(lineStream)
      .pipe(normalizer)
      .pipe(
        new Stream.Writable({
          objectMode: true,
          write(chunk, encoding, callback) {
            console.log(chunk.toString());
            callback();
          },
        })
      )
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
