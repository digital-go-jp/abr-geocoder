// reflect-metadata is necessary for DI
import 'reflect-metadata';

import { Database } from 'better-sqlite3';
import byline from 'byline';
import fs from 'node:fs';
import path from 'node:path';
import { Transform, Writable } from 'node:stream';
import { DependencyContainer } from 'tsyringe';
import {
  AbrgError,
  AbrgErrorLevel,
  AbrgMessage,
  OutputFormat,
} from '../../domain';
import {
  CsvTransform,
  GeoJsonTransform,
  JsonTransform,
  NdGeoJsonTransform,
  NdJsonTransform,
} from '../../interface-adapter';
import { getReadStreamFromSource } from '../../usecase/';
import { StreamGeocoder } from './StreamGeocoder.class';

export const onGeocoding = async ({
  source,
  destination,
  format,
  fuzzy,
  container,
}: {
  source: string;
  destination: string;
  dataDir: string;
  resourceId: string;
  format: OutputFormat;
  fuzzy?: string;
  container: DependencyContainer;
}) => {
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

      case OutputFormat.NDJSON:
        return container.resolve<NdJsonTransform>('ndjson-formatter');

      case OutputFormat.NDGEOJSON:
        return container.resolve<NdGeoJsonTransform>('ndgeojson-formatter');

      default:
        throw new AbrgError({
          messageId: AbrgMessage.UNSUPPORTED_OUTPUT_FORMAT,
          level: AbrgErrorLevel.ERROR,
        });
    }
  })(format);

  // 出力先（ファイル or stdout）の選択
  const outputStream: Writable = (destination => {
    if (
      destination === '-' ||
      destination === '' ||
      destination === undefined
    ) {
      return process.stdout;
    }

    return fs.createWriteStream(path.normalize(destination), 'utf8');
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
