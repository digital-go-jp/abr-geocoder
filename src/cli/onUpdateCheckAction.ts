import {DownloadPgmOpts} from './onDownloadAction';
import {CkanDownloader} from './class/CkanDownloader';
import {container} from "tsyringe";
import { getDataDir } from '../config';
import { noralInitialize } from './config/normal';

export const onUpdateCheckAction = async (options: DownloadPgmOpts) => {
  
  const dataDir = await getDataDir(options.data);
  const ckanId = options.source;
  await noralInitialize({
    dataDir,
    ckanId,
  });

  const downloader = container.resolve(CkanDownloader);
  const {updateAvailable} = await downloader.updateCheck({
    ckanId,
  });

  if (!updateAvailable) {
    return Promise.reject('現状データが最新です。更新を中断します。');
  }

  console.log(
    'ローカルのデータが更新できます。 abrg download で更新してください。'
  );
};
