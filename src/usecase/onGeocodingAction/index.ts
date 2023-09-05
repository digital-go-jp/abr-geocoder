export * from './getReadStreamFromSource';
export * from './types';

import { Database } from 'better-sqlite3';
import byline from 'byline';
import { Writable } from 'node:stream';
import { container } from 'tsyringe';
import {
  setupContainer,
  setupContainerForTest,
  setupContainerParams,
} from '../../interface-adapter';
import { getReadStreamFromSource } from './getReadStreamFromSource';
import { GeocodingParams, OutputFormat } from './types';
import { StreamGeocoder } from './StreamGeocoder.class';
import { CsvTransform, GeoJsonTransform, JsonTransform } from './formatters';
import { GeocodeResultFields } from './GeocodeResult.class';
import { AbrgError, AbrgErrorLevel, AbrgMessage } from '../../domain';
import fs from 'node:fs';

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
    format,
    fuzzy,
  }: GeocodingParams) => {
    const db: Database = container.resolve('Database');

    const geocoder = await StreamGeocoder.create(db, fuzzy);

    const lineStream = byline.createStream();

    const formatter = (format => {
      switch (format) {
        case OutputFormat.CSV:
          return new CsvTransform({
            skipHeader: false,
            columns: [
              GeocodeResultFields.INPUT,
              GeocodeResultFields.PREFECTURE,
              GeocodeResultFields.CITY,
              GeocodeResultFields.LG_CODE,
              GeocodeResultFields.TOWN,
              GeocodeResultFields.TOWN_ID,
              GeocodeResultFields.BLOCK,
              GeocodeResultFields.BLOCK_ID,
              GeocodeResultFields.ADDR1,
              GeocodeResultFields.ADDR1_ID,
              GeocodeResultFields.ADDR2,
              GeocodeResultFields.ADDR2_ID,
              GeocodeResultFields.OTHER,
              GeocodeResultFields.LATITUDE,
              GeocodeResultFields.LONGITUDE,
            ],
          });
        case OutputFormat.JSON:
          return new JsonTransform();

        case OutputFormat.GEOJSON:
          return new GeoJsonTransform();

        default:
          throw new AbrgError({
            messageId: AbrgMessage.UNSUPPORTED_OUTPUT_FORMAT,
            level: AbrgErrorLevel.ERROR,
          });
      }
    })(format);

    const outputStream: Writable = (destination => {
      if (destination === '-' || destination === '') {
        return process.stdout;
      }

      return fs.createWriteStream(fs.realpathSync(destination));
    })(destination);

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
