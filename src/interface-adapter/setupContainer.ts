import { MultiBar, SingleBar } from 'cli-progress';
import fs from 'node:fs';
import path from 'node:path';
import { container } from 'tsyringe';
import {
  provideDatabase,
  provideLogger,
  provideMultiProgressBar,
  provideProgressBar,
} from './providers';
import { setupContainerParams } from './setupContainerParams';
import { PrefectureName } from '../usecase';

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

  const sqliteFilePath = path.join(dataDir, `${ckanId}.sqlite`);
  const schemaFilePath = path.join(__dirname, 'schema.sql');

  const db = await provideDatabase({
    schemaFilePath,
    sqliteFilePath,
  });
  container.register('Database', {
    useValue: db,
  });

  const logger = provideLogger();
  container.registerInstance('Logger', logger);

  container.register<SingleBar>('ProgressBar', {
    useFactory: () => {
      return provideProgressBar();
    },
  });
  container.register<MultiBar>('MultiProgressBar', {
    useFactory: () => {
      return provideMultiProgressBar();
    },
  });
  container.register<PrefectureName[]>('Prefectures', {
    useValue: [
      PrefectureName.HOKKAIDO,
      PrefectureName.AOMORI,
      PrefectureName.IWATE,
      PrefectureName.MIYAGI,
      PrefectureName.YAMAGATA,
      PrefectureName.FUKUSHIMA,
      PrefectureName.IBARAKI,
      PrefectureName.TOCHIGI,
      PrefectureName.GUMMA,
      PrefectureName.SAITAMA,
      PrefectureName.CHIBA,
      PrefectureName.TOKYO,
      PrefectureName.KANAGAWA,
      PrefectureName.YAMANASHI,
      PrefectureName.NAGANO,
      PrefectureName.NIIGATA,
      PrefectureName.TOYAMA,
      PrefectureName.ISHIKAWA,
      PrefectureName.FUKUI,
      PrefectureName.SHIZUOKA,
      PrefectureName.AICHI,
      PrefectureName.GIFU,
      PrefectureName.MIE,
      PrefectureName.SHIGA,
      PrefectureName.KYOTO,
      PrefectureName.OSAKA,
      PrefectureName.HYOGO,
      PrefectureName.NARA,
      PrefectureName.WAKAYAMA,
      PrefectureName.OKAYAMA,
      PrefectureName.HIROSHIMA,
      PrefectureName.TOTTORI,
      PrefectureName.SHIMANE,
      PrefectureName.YAMAGUCHI,
      PrefectureName.TOKUSHIMA,
      PrefectureName.KAGAWA,
      PrefectureName.EHIME,
      PrefectureName.KOCHI,
      PrefectureName.FUKUOKA,
      PrefectureName.SAGA,
      PrefectureName.NAGASAKI,
      PrefectureName.OITA,
      PrefectureName.KUMAMOTO,
      PrefectureName.MIYAZAKI,
      PrefectureName.KAGOSHIMA,
      PrefectureName.OKINAWA,
    ],
  });
};
