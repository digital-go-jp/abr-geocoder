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
// reflect-metadata is necessary for DI
import 'reflect-metadata';

import { Database } from 'better-sqlite3';
import byline from 'byline';
import fs from 'node:fs';
import path from 'node:path';
import stream, { Transform, Writable } from 'node:stream';

import { AbrgError, AbrgErrorLevel } from '@abrg-error/abrg-error';
import { AbrgMessage } from '@abrg-message/abrg-message';
import { getReadStreamFromSource } from '@domain/geocode/get-read-stream-from-source';
import { OutputFormat } from '@domain/output-format';
import { CsvTransform } from '@interface-adapter/formatters/csv-transform';
import { GeoJsonTransform } from '@interface-adapter/formatters/geo-json-transform';
import { JsonTransform } from '@interface-adapter/formatters/json-transform';
import { NdGeoJsonTransform } from '@interface-adapter/formatters/nd-geo-json-transform';
import { NdJsonTransform } from '@interface-adapter/formatters/nd-json-transform';
import { NormalizeTransform } from '@interface-adapter/formatters/normalize-transform';
import { setupContainer } from '@interface-adapter/setup-container';
import { DI_TOKEN } from '@interface-adapter/tokens';
import { StreamGeocoder } from './stream-geocoder';

export enum GEOCODE_RESULT {
  SUCCESS = 0,
}

export const geocode = async ({
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

      case OutputFormat.NORMALIZE:
        return container.resolve<NormalizeTransform>(DI_TOKEN.NORMALIZE_FORMATTER);

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

  return GEOCODE_RESULT.SUCCESS;
};
