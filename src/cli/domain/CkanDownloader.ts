import fs, {stat} from 'node:fs';
import {
  ArchiveMetadata,
  CKANPackageShow,
  CKANResponse,
  CheckForUpdatesOutput,
  DatasetMetadata,
  IArchiveMeta,
} from '../../types';
import {Database} from 'better-sqlite3';
import {SingleBar} from 'cli-progress';
import {request, Client, Dispatcher} from 'undici';
import {Writable} from 'node:stream';
import {inject, injectable} from 'tsyringe';
import {Logger} from 'winston';
import { AbrgError, AbrgErrorLevel } from './AbrgError';
import { MESSAGE } from '../usecase';

export interface CkanDownloaderOptions {
  db: Database;
  ckanBaseUrl: string;
  userAgent: string;
  silent: boolean;
}

@injectable()
export class CkanDownloader {
  constructor(
    @inject('Database') private readonly db: Database,
    @inject('USER_AGENT') private readonly userAgent: string,
    @inject('getDatasetUrl')
    private readonly getDatasetUrl: (ckanId: string) => string,
    @inject('Logger') private readonly logger: Logger,
    @inject('strResource') private readonly strResource: (resourceId: MESSAGE) => string,
    @inject('DownloadProgressBar') private readonly progressBar?: SingleBar,
  ) {
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
    
    const {statusCode, body} = await request(requestUrl, {
      headers: {
        'user-agent': this.userAgent,
      }
    });

    const HTTP_OK = 200;

    if (statusCode !== HTTP_OK) {
      this.logger.debug(await body.text());
      throw new AbrgError({
        messageId: MESSAGE.DATA_DOWNLOAD_ERROR,
        level: AbrgErrorLevel.ERROR,
      });
    }

    const metaWrapper = (await body.json()) as CKANResponse<CKANPackageShow>;
    if (metaWrapper.success === false) {
      throw new AbrgError({
        messageId: MESSAGE.CANNOT_FIND_THE_SPECIFIED_RESOURCE,
        level: AbrgErrorLevel.ERROR,
      });
    }

    const meta = metaWrapper.result;
    const csvResource = meta.resources.find(x =>
      x.format.toLowerCase().startsWith('csv')
    );

    if (!csvResource) {
      throw new AbrgError({
        messageId: MESSAGE.DOWNLOADED_DATA_DOES_NOT_CONTAIN_THE_RESOURCE_CSV,
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
    try {
      const allMetadata = this.db
        .prepare('SELECT "key", "value" FROM "metadata"')
        .all() as IArchiveMeta[];

      const result: ArchiveMetadata = {};
      allMetadata.forEach((row: IArchiveMeta) => {
        result[row.key] = row.value;
      });

      return result;
    } catch (e: unknown) {
      this.logger.debug(e);
      return undefined;
    }
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
    this.logger.info(
      `${this.strResource(MESSAGE.START_DOWNLOADING)}: ${requestUrl.toString()} -> ${outputFile}`,
    );
    const client = new Client(requestUrl.origin);
    const wrapProgressBar = this.progressBar;

    const streamFactory: Dispatcher.StreamFactory = ({statusCode, headers}) => {
      if (statusCode !== 200) {
        this.logger.debug(`download error: status code = ${statusCode}`);
        throw new AbrgError({
          messageId: MESSAGE.DATA_DOWNLOAD_ERROR,
          level: AbrgErrorLevel.ERROR,
        });
      }
      const decimal = 10;
      const contentLength = parseInt(
        headers['content-length']!.toString(),
        decimal
      );

      wrapProgressBar?.start(contentLength, 0);

      const writerStream = fs.createWriteStream(outputFile);

      const result = new Writable({
        write(chunk, _, callback) {
          if (chunk.length > 0) {
            wrapProgressBar?.increment(chunk.length);
            wrapProgressBar?.updateETA();
          }
          writerStream.write(chunk);
          callback();
        },
      });

      result.on('end', () => {
        writerStream.end();
        wrapProgressBar?.stop();
      });
      return result;
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
