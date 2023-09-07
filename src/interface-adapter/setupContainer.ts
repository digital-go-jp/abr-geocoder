import { MultiBar, SingleBar } from 'cli-progress';
import fs from 'node:fs';
import path from 'node:path';
import { container } from 'tsyringe';
import {
  CsvTransform,
  GeoJsonTransform,
  JsonTransform,
  provideCsvFormatter,
  provideGeoJsonFormatter,
  provideJsonFormatter,
} from './formatters/';
import {
  provideDatabase,
  provideLogger,
  provideMultiProgressBar,
  provideProgressBar,
} from './providers';
import { 
  AbrgError,
  AbrgErrorLevel,
  AbrgMessage,
  bubblingFindFile,
} from '../domain';

export interface setupContainerParams {
  dataDir: string;
  ckanId: string;
}

export const setupContainer = async ({
  dataDir,
  ckanId,
}: setupContainerParams) => {
  container.register('USER_AGENT', {
    useValue: 'curl/7.81.0',
  });
  container.register('getDatasetUrl', {
    useValue: (ckanId: string) => {
      return `https://catalog.registries.digital.go.jp/rc/api/3/action/package_show?id=${ckanId}`;
    },
  });

  const existDataDir = fs.existsSync(dataDir);
  if (!existDataDir) {
    await fs.promises.mkdir(dataDir);
  }

  //
  const sqliteFilePath = path.join(dataDir, `${ckanId}.sqlite`);

  // データベースを構築するために必要なSQL
  const schemaFilePath = await bubblingFindFile(__dirname, 'schema.sql');
  if (schemaFilePath === undefined || !fs.existsSync(schemaFilePath)) {
    throw new AbrgError({
      messageId: AbrgMessage.CANNOT_FIND_SQL_FILE,
      level: AbrgErrorLevel.ERROR,
    });
  }

  // アプリケーション全体を通して使用するデータベース
  const db = await provideDatabase({
    schemaFilePath,
    sqliteFilePath,
  });
  container.register('Database', {
    useValue: db,
  });

  // ロガー
  const logger = provideLogger();
  container.registerInstance('Logger', logger);

  // ダウロードのときに表示するプログレスバー
  container.register<SingleBar>('ProgressBar', {
    useFactory: () => {
      return provideProgressBar();
    },
  });

  // CSV を データベースに保存するとに表示するプログレスバー
  container.register<MultiBar>('MultiProgressBar', {
    useFactory: () => {
      return provideMultiProgressBar();
    },
  });

  // Geocoding結果の出力を整形するフォーマッター
  container.register<CsvTransform>('csv-formatter', {
    useFactory: () => {
      return provideCsvFormatter();
    },
  });
  container.register<GeoJsonTransform>('geojson-formatter', {
    useFactory: () => {
      return provideGeoJsonFormatter();
    },
  });
  container.register<JsonTransform>('json-formatter', {
    useFactory: () => {
      return provideJsonFormatter();
    },
  });
};
