export * from './JPAddressNormalizer';
export * from './getReadStreamFromSource';
export * from './types';

import { Database } from 'better-sqlite3';
import byline from 'byline';
import { SingleBar } from 'cli-progress';
import { container } from "tsyringe";
import { Logger } from 'winston';
import {
  setupContainer,
  setupContainerForTest,
  setupContainerParams,
} from '../../interface-adapter';
import { JPAddressNormalizer } from './JPAddressNormalizer';
import { getPrefectureRegexPatterns } from './getPrefectureRegexPatterns';
import { getPrefecturesFromDB } from './getPrefecturesFromDB';
import { getReadStreamFromSource } from './getReadStreamFromSource';
import { getSameNamedPrefecturePatterns } from './getSameNamedPrefecturePatterns';
import { GeocodingParams } from './types';

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
    fuzzy = '?',
  } : GeocodingParams) => {
    const lineStream = byline.createStream();

    const db: Database = container.resolve('Database');
    const logger: Logger = container.resolve('Logger');
    const progressBar = container.resolve<SingleBar>('DownloadProgressBar');

    const convertToHankaku =  (str: string) => {
      return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => {
        return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
      });
    };

    const normalizer = new JPAddressNormalizer({
      convertToHankaku,
    });

    // 都道府県名の正規化
    const prefectures = await getPrefecturesFromDB({
      db,
    });
    const prefPatterns = getPrefectureRegexPatterns();
    const sameNamedPrefPatterns = getSameNamedPrefecturePatterns({
      prefPatterns,
      prefectures,
    });
    
    getReadStreamFromSource(source)
      .pipe(lineStream)
      .pipe(normalizer)
      .pipe(process.stdout)
      .on('end', () => {
        db.close();
      })
  }

}




export const onGeocodingAction = async (
  params: GeocodingParams,
) => {
  await geocodingAction.init({
    dataDir: params.dataDir,
    ckanId: params.resourceId,
  });
  await geocodingAction.start(params);
};

