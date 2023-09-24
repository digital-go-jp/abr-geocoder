import { MultiBar, SingleBar } from 'cli-progress';
import fs from 'node:fs';
import path from 'node:path';
import { DependencyContainer, container } from 'tsyringe';
import {
  CsvTransform,
  GeoJsonTransform,
  JsonTransform,
  NdGeoJsonTransform,
  NdJsonTransform,
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
}: setupContainerParams): Promise<DependencyContainer> => {
  const myContainer = container.createChildContainer();

  myContainer.register('USER_AGENT', {
    useValue: 'curl/7.81.0',
  });
  myContainer.register('DATASET_URL', {
    useValue: `https://catalog.registries.digital.go.jp/rc/api/3/action/package_show?id=${ckanId}`,
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
  myContainer.register('DATABASE', {
    useValue: db,
  });

  // ロガー
  const logger = provideLogger();
  myContainer.registerInstance('LOGGER', logger);

  // ダウロードのときに表示するプログレスバー
  myContainer.register<SingleBar>('PROGRESS_BAR', {
    useFactory: () => {
      return provideProgressBar();
    },
  });

  // CSV を データベースに保存するとに表示するプログレスバー
  myContainer.register<MultiBar>('MULTI_PROGRESS_BAR', {
    useFactory: () => {
      return provideMultiProgressBar();
    },
  });

  // Geocoding結果の出力を整形するフォーマッター
  myContainer.register<CsvTransform>('csv-formatter', {
    useFactory: () => {
      return CsvTransform.create(CsvTransform.DEFAULT_COLUMNS);
    },
  });
  myContainer.register<GeoJsonTransform>('geojson-formatter', {
    useFactory: () => {
      return GeoJsonTransform.create();
    },
  });
  myContainer.register<NdGeoJsonTransform>('ndgeojson-formatter', {
    useFactory: () => {
      return NdGeoJsonTransform.create();
    },
  });
  myContainer.register<JsonTransform>('json-formatter', {
    useFactory: () => {
      return JsonTransform.create();
    },
  });
  myContainer.register<NdJsonTransform>('ndjson-formatter', {
    useFactory: () => {
      return NdJsonTransform.create();
    },
  });

  return myContainer;
};
