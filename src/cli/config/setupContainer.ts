import path from 'node:path';
import { container, instanceCachingFactory } from "tsyringe";
import { CkanDownloader } from "../domain/";
import { provideDatabase } from './provideDatabase';
import { provideLogger } from './provideLogger';
import { provideDownloadProgressBar } from './provideDownloadProgressBar';
import StrResourceFunc, {MESSAGE} from '../usecase/strResource';
export type StrResource = (messageId: MESSAGE) => string;

export const setupContainer = async ({
  dataDir,
  ckanId,
}: {
  dataDir: string;
  ckanId: string;
}) => {


  container.register(
    'strResource',
    {
      useValue: StrResourceFunc(),
    },
  );
  container.register(
    'USER_AGENT',
    {
      useValue: 'curl/7.81.0',
    },
  );
  container.register('getDatasetUrl', {
    useValue: (ckanId: string) => {
      // return `http://localhost:8080/${ckanId}.zip`;
      return `https://catalog.registries.digital.go.jp/rc/api/3/action/package_show?id=${ckanId}`;
    },
  });

  const sqliteFilePath = path.join(dataDir, `${ckanId}.sqlite`);
  const schemaFilePath = path.join(__dirname, '..', '..', '..', `schema.sql`);
  
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

  container.register('Downloader', {
    useFactory: instanceCachingFactory<CkanDownloader>(c => c.resolve(CkanDownloader)),
  });
};


