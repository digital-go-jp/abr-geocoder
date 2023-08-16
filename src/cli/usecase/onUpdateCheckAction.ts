// reflect-metadata is necessary for DI
import "reflect-metadata";

import { Database } from 'better-sqlite3';
import { container } from "tsyringe";
import { Logger } from 'winston';
import {
  AbrgError,
  AbrgErrorLevel,
  AbrgMessage,
  CkanDownloader,
  getDataDir,
} from '../domain';
import {
  setupContainer,
  setupContainerForTest,
  setupContainerParams,
} from '../interface-adapter';

export namespace updateCheck {
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

  export async function start(params: setupContainerParams) {
    if (!initialized) {
      throw new Error('Must run init() or initForTest() before involving this function');
    }

    const logger = container.resolve<Logger>('Logger');
    const downloader = new CkanDownloader({
      db: container.resolve<Database>('Database'),
      userAgent: container.resolve('USER_AGENT'),
      getDatasetUrl: container.resolve('getDatasetUrl'),
    });
  
    const {updateAvailable} = await downloader.updateCheck({
      ckanId: params.ckanId,
    });
  
    logger.info(
      AbrgMessage.toString(
        AbrgMessage.NEW_DATASET_IS_AVAILABLE,
      ),
    );
    if (!updateAvailable) {
      return Promise.reject(
        new AbrgError({
          messageId: AbrgMessage.ERROR_NO_UPDATE_IS_AVAILABLE,
          level: AbrgErrorLevel.INFO,
        }),
      );
    }
    logger.info(
      AbrgMessage.toString(
        AbrgMessage.NEW_DATASET_IS_AVAILABLE,
      ),
    );
  }
}

export const onUpdateCheckAction = async (params: setupContainerParams) => {
  await updateCheck.init(params);
  await updateCheck.start(params);
};