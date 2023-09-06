// reflect-metadata is necessary for DI
import 'reflect-metadata';

import { Database } from 'better-sqlite3';
import byline from 'byline';
import fs from 'node:fs';
import { Transform, Writable } from 'node:stream';
import { container } from 'tsyringe';
import {
  AbrgError,
  AbrgErrorLevel,
  AbrgMessage,
  GeocodingParams,
  OutputFormat,
} from '../../domain';
import {
  CsvTransform,
  GeoJsonTransform,
  JsonTransform,
  setupContainer,
  setupContainerParams,
} from '../../interface-adapter';
import { getReadStreamFromSource } from '../../usecase/';
import { StreamGeocoder } from './StreamGeocoder.class';

export namespace geocodingAction {
  let initialized = false;

  export async function init(params: setupContainerParams) {
    if (initialized) {
      return;
    }
    initialized = true;
    await setupContainer(params);
  }

  export const start = async ({
    source,
    destination,
    format,
    fuzzy,
  }: GeocodingParams) => {
    // データベースのインスタンスを取得
    const db: Database = container.resolve('Database');

    // Geocodingを行うメイン部分
    const geocoder = await StreamGeocoder.create(db, fuzzy);

    // Streamを1行単位にしてくれる TransformStream
    const lineStream = byline.createStream();

    // Geocoding結果を出力するフォーマッタ
    const formatter: Transform = (format => {
      switch (format) {
        case OutputFormat.CSV:
          return container.resolve<CsvTransform>('csv-formatter');

        case OutputFormat.JSON:
          return container.resolve<JsonTransform>('json-formatter');

        case OutputFormat.GEOJSON:
          return container.resolve<GeoJsonTransform>('geojson-formatter');

        default:
          throw new AbrgError({
            messageId: AbrgMessage.UNSUPPORTED_OUTPUT_FORMAT,
            level: AbrgErrorLevel.ERROR,
          });
      }
    })(format);

    // 出力先（ファイル or stdout）の選択
    const outputStream: Writable = (destination => {
      if (destination === '-' || destination === '') {
        return process.stdout;
      }

      return fs.createWriteStream(fs.realpathSync(destination));
    })(destination);

    // メイン処理
    getReadStreamFromSource(source)
      .pipe(lineStream)
      .pipe(geocoder)
      .pipe(formatter)
      .pipe(outputStream)
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
