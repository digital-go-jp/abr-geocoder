import { Database } from 'better-sqlite3';
import EventEmitter from 'node:events';
import fs from 'node:fs';
import { Transform } from 'node:stream';
import { Client, Dispatcher, request } from 'undici';
import { AbrgError, AbrgErrorLevel } from './AbrgError';
import { AbrgMessage } from './AbrgMessage';
import {
  ArchiveMetadata,
  CKANPackageShow,
  CKANResponse,
  CheckForUpdatesOutput,
  DatasetMetadata,
  IArchiveMeta,
} from './types';

export enum CkanDownloaderEvent {
  START = 'start',
  PROGRESS = 'progress',
  END = 'end',
}

export interface CkanDownloaderParams {
  db: Database;
  userAgent: string;
  getDatasetUrl: (ckanId: string) => string;
}

export class CkanDownloader extends EventEmitter {
  private readonly db: Database;
  private readonly userAgent: string;
  private readonly getDatasetUrl: (ckanId: string) => string;

  constructor({
    db,
    userAgent,
    getDatasetUrl,
  }: CkanDownloaderParams) {
    super();
    this.db = db;
    this.userAgent = userAgent;
    this.getDatasetUrl = getDatasetUrl;
    Object.freeze(this);
  }

  /**
   * Find csv resouce for given ckanId.
   * 
   * Access to the CKAN api, then parse it.
   * (i.e. https://catalog.registries.digital.go.jp/rc/api/3/action/package_show?id=ba000001)
   * 
   * @param ckanId 
   * @returns {
   *  fileUrl: download url for the csv resource.
   *  lastModified: the timestamp last modified of the csv resource. (ISO8601)
   * }
   */
  async getDatasetMetadata({
    ckanId,
  }: {
    ckanId: string;
  }): Promise<DatasetMetadata> {
    const requestUrl = this.getDatasetUrl(ckanId);

    const { statusCode, body } = await request(requestUrl, {
      headers: {
        'user-agent': this.userAgent,
      }
    });

    const HTTP_OK = 200;

    if (statusCode !== HTTP_OK) {
      // this.logger.debug(await body.text());
      throw new AbrgError({
        messageId: AbrgMessage.DATA_DOWNLOAD_ERROR,
        level: AbrgErrorLevel.ERROR,
      });
    }

    const metaWrapper = (await body.json()) as CKANResponse<CKANPackageShow>;
    if (metaWrapper.success === false) {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_FIND_THE_SPECIFIED_RESOURCE,
        level: AbrgErrorLevel.ERROR,
      });
    }

    const meta = metaWrapper.result;
    const csvResource = meta.resources.find(x =>
      x.format.toLowerCase().startsWith('csv')
    );

    if (!csvResource) {
      throw new AbrgError({
        messageId: AbrgMessage.DOWNLOADED_DATA_DOES_NOT_CONTAIN_THE_RESOURCE_CSV,
        level: AbrgErrorLevel.ERROR,
      });
    }

    return {
      fileUrl: csvResource.url,
      lastModified: csvResource.last_modified,
    };
  }

  /**
   * Read the last modified timestamp from the database.
   * @returns 
   */
  async getArchiveMetadata(): Promise<ArchiveMetadata | undefined> {
    const allMetadata = this.db
      .prepare('SELECT "key", "value" FROM "metadata"')
      .all() as IArchiveMeta[];

    const result: ArchiveMetadata = {};
    allMetadata.forEach((row: IArchiveMeta) => {
      result[row.key] = row.value;
    });

    return result;
  }

  async updateCheck({
    ckanId,
  }: {
    ckanId: string;
  }): Promise<CheckForUpdatesOutput> {
    const upstreamMeta = await this.getDatasetMetadata({
      ckanId,
    });
    const currentArchiveMeta = await this.getArchiveMetadata();

    const updateAvailable = (() => {
      if (!currentArchiveMeta?.last_modified) {
        return true;
      }
      return currentArchiveMeta.last_modified < upstreamMeta.lastModified;
    })();

    return {
      updateAvailable,
      upstreamMeta,
    };
  }

  async download({
    requestUrl,
    outputFile,
  }: {
    requestUrl: URL;
    outputFile: string;
  }): Promise<Boolean> {
    // perform the download

    // this.logger.info(
    //   `${AbrgMessage.toString(AbrgMessage.START_DOWNLOADING)}: ${requestUrl.toString()} -> ${outputFile}`,
    // );

    const client = new Client(requestUrl.origin);
    const self: CkanDownloader = this;

    const streamFactory: Dispatcher.StreamFactory = ({ statusCode, headers }) => {
      if (statusCode !== 200) {
        // this.logger.debug(`download error: status code = ${statusCode}`);
        throw new AbrgError({
          messageId: AbrgMessage.DATA_DOWNLOAD_ERROR,
          level: AbrgErrorLevel.ERROR,
        });
      }
      const decimal = 10;
      const contentLength = parseInt(
        headers['content-length']!.toString(),
        decimal
      );
      self.emit(CkanDownloaderEvent.START, {
        total: contentLength,
      });

      const writerStream = fs.createWriteStream(outputFile);
      const writable = new Transform({
        transform(chunk, encoding, callback) {
          self.emit(CkanDownloaderEvent.PROGRESS, {
            incrementSize: chunk.length,
          });
          callback(null, chunk);
        },
        destroy(error, callback) {
          writerStream.end();
          self.emit(CkanDownloaderEvent.END);
          callback(null);
        },
      });
      writable.pipe(writerStream);


      // const result = new Writable({
      //   write(chunk, _, callback) {
      //     if (chunk.length > 0) {
      //       // wrapProgressBar?.increment(chunk.length);
      //       // wrapProgressBar?.updateETA();
      //     }
      //     writerStream.write(chunk);
      //     callback();
      //   },
      // });

      // result.on('end', () => {
      //   writerStream.end();
      //   wrapProgressBar?.stop();
      // });
      return writable;
    };

    await client.stream(
      {
        path: requestUrl.pathname,
        method: 'GET',
        headers: {
          'user-agent': this.userAgent,
        },
      },
      streamFactory
    );

    return Promise.resolve(true);
  }
}
