import path from 'node:path';
import {getDataDir} from '../config';
import {DownloadPgmOpts} from '../download';
import {CkanDownloader} from '../download/CkanDownloader';
import {CKAN_BASE_REGISTRY_URL} from '../ckan';

export const onUpdateCheckAction = async (options: DownloadPgmOpts) => {
  const ckanId = options.source;

  const dataDir = await getDataDir(options.data);
  const sqlitePath = path.join(dataDir, `${ckanId}.sqlite`);

  const downloader = new CkanDownloader({
    ckanId,
    sqlitePath,
    ckanBaseUrl: CKAN_BASE_REGISTRY_URL,
    userAgent: 'curl/7.81.0',
    silent: false,
  });

  const {updateAvailable} = await downloader.updateCheck();

  if (!updateAvailable) {
    return Promise.reject('現状データが最新です。更新を中断します。');
  }
  console.log(
    'ローカルのデータが更新できます。 abrg download で更新してください。'
  );
};
