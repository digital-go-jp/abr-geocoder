// reflect-metadata is necessary for DI
import 'reflect-metadata';
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
} from '../interface-adapter/formatters';
import {
  provideDatabase,
  provideLogger,
  provideMultiProgressBar,
  provideProgressBar,
  provideInifinityProgressBar,
} from './providers';
import {
  AbrgError,
  AbrgErrorLevel,
  AbrgMessage,
  upwardFileSearch,
} from '../domain';
import CLIInfinityProgress from 'cli-infinity-progress';
import { DI_TOKEN } from './tokens';

export interface setupContainerParams {
  dataDir: string;
  ckanId: string;
}

export const setupContainer = async ({
  dataDir,
  ckanId,
}: setupContainerParams): Promise<DependencyContainer> => {
  const myContainer = container.createChildContainer();

  myContainer.register(DI_TOKEN.USER_AGENT, {
    useValue: 'curl/7.81.0',
  });
  myContainer.register(DI_TOKEN.DATASET_URL, {
    useValue: `https://catalog.registries.digital.go.jp/rc/api/3/action/package_show?id=${ckanId}`,
  });

  const existDataDir = fs.existsSync(dataDir);
  if (!existDataDir) {
    await fs.promises.mkdir(dataDir);
  }

  //
  const sqliteFilePath = path.join(dataDir, `${ckanId}.sqlite`);

  // データベースを構築するために必要なSQL
  const schemaFilePath = await upwardFileSearch(__dirname, 'schema.sql');
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
  myContainer.register(DI_TOKEN.DATABASE, {
    useValue: db,
  });

  // ロガー
  const logger = provideLogger();
  myContainer.registerInstance(DI_TOKEN.LOGGER, logger);

  //
  myContainer.register<CLIInfinityProgress>(DI_TOKEN.INFINITY_PROGRESS_BAR, {
    useFactory: () => {
      return provideInifinityProgressBar();
    },
  });

  // ダウロードのときに表示するプログレスバー
  myContainer.register<SingleBar>(DI_TOKEN.PROGRESS_BAR, {
    useFactory: () => {
      return provideProgressBar();
    },
  });

  // CSV を データベースに保存するとに表示するプログレスバー
  myContainer.register<MultiBar>(DI_TOKEN.MULTI_PROGRESS_BAR, {
    useFactory: () => {
      return provideMultiProgressBar();
    },
  });

  // Geocoding結果の出力を整形するフォーマッター
  myContainer.register<CsvTransform>(DI_TOKEN.CSV_FORMATTER, {
    useFactory: () => {
      return CsvTransform.create(CsvTransform.DEFAULT_COLUMNS);
    },
  });
  myContainer.register<GeoJsonTransform>(DI_TOKEN.GEOJSON_FORMATTER, {
    useFactory: () => {
      return GeoJsonTransform.create();
    },
  });
  myContainer.register<NdGeoJsonTransform>(DI_TOKEN.NDGEOJSON_FORMATTER, {
    useFactory: () => {
      return NdGeoJsonTransform.create();
    },
  });
  myContainer.register<JsonTransform>(DI_TOKEN.JSON_FORMATTER, {
    useFactory: () => {
      return JsonTransform.create();
    },
  });
  myContainer.register<NdJsonTransform>(DI_TOKEN.NDJSON_FORMATTER, {
    useFactory: () => {
      return NdJsonTransform.create();
    },
  });

  return myContainer;
};
