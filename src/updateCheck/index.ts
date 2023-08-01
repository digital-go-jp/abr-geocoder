import path from 'node:path';
import {USER_AGENT, getDataDir} from '../config';
import {DownloadPgmOpts, onDownloadAction} from '../download';
import {CkanDownloader} from '../download/CkanDownloader';
import {CKAN_BASE_REGISTRY_URL} from '../ckan';
import { createDatabase } from '../common';

export const onUpdateCheckAction = async (options: DownloadPgmOpts) => {
  
  const dataDir = await getDataDir(options.data);
  const ckanId = options.source;

  const sqlitePath = path.join(dataDir, `${ckanId}.sqlite`);
  const schemaPath = path.join(__dirname, '../../schema.sql');
  const db = await createDatabase({
    sqlitePath,
    schemaPath,
  });

  const downloader = new CkanDownloader({
    ckanId,
    db,
    ckanBaseUrl: CKAN_BASE_REGISTRY_URL,
    userAgent: USER_AGENT,
    silent: false,
  });

  const {updateAvailable } = await downloader.updateCheck();

  if (!updateAvailable) {
    return Promise.reject('現状データが最新です。更新を中断します。');
  }
  console.log(
    'ローカルのデータが更新できます。 abrg download で更新してください。'
  );
};
