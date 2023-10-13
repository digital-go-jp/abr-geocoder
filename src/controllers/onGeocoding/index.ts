// reflect-metadata is necessary for DI
import 'reflect-metadata';

import { Database } from 'better-sqlite3';
import byline from 'byline';
import fs from 'node:fs';
import path from 'node:path';
import stream, { Transform, Writable } from 'node:stream';
import {
  AbrgError,
  AbrgErrorLevel,
  AbrgMessage,
  OutputFormat,
} from '../../domain';
import {
  CsvTransform,
  DI_TOKEN,
  GeoJsonTransform,
  JsonTransform,
  NdGeoJsonTransform,
  NdJsonTransform,
  setupContainer,
} from '../../interface-adapter';
import { getReadStreamFromSource } from '../../usecase/';
import { StreamGeocoder } from './StreamGeocoder';

export enum ON_GECODING_RESULT {
  SUCCESS = 0,
}

export const onGeocoding = async ({
  ckanId,
  dataDir,
  destination,
  format,
  fuzzy,
  source,
}: {
  ckanId: string;
  dataDir: string;
  destination?: string;
  format: OutputFormat;
  fuzzy?: string;
  source: string;
}) => {
  const container = await setupContainer({
    dataDir,
    ckanId,
  });

  // データベースのインスタンスを取得
  const db: Database = container.resolve(DI_TOKEN.DATABASE);

  // Geocodingを行うメイン部分
  const geocoder = await StreamGeocoder.create(db, fuzzy);

  // Streamを1行単位にしてくれる TransformStream
  const lineStream = byline.createStream();

  // Geocoding結果を出力するフォーマッタ
  const formatter: Transform = (format => {
    switch (format) {
      case OutputFormat.CSV:
        return container.resolve<CsvTransform>(DI_TOKEN.CSV_FORMATTER);

      case OutputFormat.JSON:
        return container.resolve<JsonTransform>(DI_TOKEN.JSON_FORMATTER);

      case OutputFormat.GEOJSON:
        return container.resolve<GeoJsonTransform>(DI_TOKEN.GEOJSON_FORMATTER);

      case OutputFormat.NDJSON:
        return container.resolve<NdJsonTransform>(DI_TOKEN.NDJSON_FORMATTER);

      case OutputFormat.NDGEOJSON:
        return container.resolve<NdGeoJsonTransform>(
          DI_TOKEN.NDGEOJSON_FORMATTER
        );

      default:
        throw new AbrgError({
          messageId: AbrgMessage.UNSUPPORTED_OUTPUT_FORMAT,
          level: AbrgErrorLevel.ERROR,
        });
    }
  })(format);

  // 出力先（ファイル or stdout）の選択
  const outputStream: Writable = (destination => {
    if (destination === '' || destination === undefined) {
      return process.stdout;
    }
    const result = fs.createWriteStream(path.normalize(destination), 'utf8');
    return result;
  })(destination);

  // メイン処理
  await stream.promises.pipeline(
    getReadStreamFromSource(source),
    lineStream,
    geocoder,
    formatter,
    outputStream
  );
  db.close();

  return ON_GECODING_RESULT.SUCCESS;
};
