import path from 'node:path';
import fs from 'node:fs';
import { container } from "tsyringe";
import {
  provideDatabase,
  provideDownloadProgressBar,
  provideLogger,
} from './providers';
import {setupContainerParams} from './setupContainerParams';

export const setupContainer = async ({
  dataDir,
  ckanId,
}: setupContainerParams) => {

  container.register(
    'USER_AGENT',
    {
      useValue: 'curl/7.81.0',
    },
  );
  container.register('getDatasetUrl', {
    useValue: (ckanId: string) => {
      return `https://catalog.registries.digital.go.jp/rc/api/3/action/package_show?id=${ckanId}`;
    },
  });

  const existDataDir = fs.existsSync(dataDir);
  if (!existDataDir) {
    await fs.promises.mkdir(dataDir)
  }

  const sqliteFilePath = path.join(dataDir, `${ckanId}.sqlite`);
  const schemaFilePath = path.join(__dirname, 'schema.sql');
  
  const db = await provideDatabase({
    schemaFilePath,
    sqliteFilePath,
  })
  container.register('Database', {
    useValue: db,
  });

  const logger = provideLogger();
  container.registerInstance('Logger', logger);

  const progress = provideDownloadProgressBar();
  container.registerInstance('DownloadProgressBar', progress);
};


