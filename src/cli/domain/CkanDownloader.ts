import { SingleBar } from 'cli-progress';
import fs from 'node:fs';
import { Transform } from 'node:stream';
import { Client, Dispatcher, request } from 'undici';
import { AbrgError, AbrgErrorLevel } from './AbrgError';
import { AbrgMessage } from './AbrgMessage';
import {
  CKANPackageShow,
  CKANResponse,
  CheckForUpdatesOutput,
  DatasetMetadata
} from './types';

export interface CkanDownloaderParams {
  ckanId: string;
  userAgent: string;
  getLastDatasetModified: () => Promise<string | undefined>;
  getDatasetUrl: (ckanId: string) => string;
}

export class CkanDownloader {
  private readonly getLastDatasetModified: () => Promise<string | undefined>;
  private readonly userAgent: string;
  private readonly getDatasetUrl: (ckanId: string) => string;
  private readonly ckanId: string;

  constructor({
    ckanId,
    userAgent,
    getDatasetUrl,
    getLastDatasetModified,
  }: CkanDownloaderParams) {
    this.userAgent = userAgent;
    this.getLastDatasetModified = getLastDatasetModified;
    this.getDatasetUrl = getDatasetUrl;
    this.ckanId = ckanId;
    Object.freeze(this);
  }


  async getDatasetMetadata(): Promise<DatasetMetadata> {

    const { statusCode, body } = await request(
      this.getDatasetUrl(this.ckanId),
      {
        headers: {
          'user-agent': this.userAgent,
        }
      },
    );

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

  async updateCheck(): Promise<CheckForUpdatesOutput> {
    const upstreamMeta = await this.getDatasetMetadata();
    const lastModified = await this.getLastDatasetModified();

    const updateAvailable = (() => {
      if (!lastModified) {
        return true;
      }
      return lastModified < upstreamMeta.lastModified;
    })();

    return {
      updateAvailable,
      upstreamMeta,
    };
  }

  async download({
    progressBar,
    downloadDir,
  }: {
    downloadDir: string;
    progressBar?: SingleBar;
  }): Promise<string> {
    const upstreamMeta = await this.getDatasetMetadata();
    const requestUrl = new URL(upstreamMeta.fileUrl);
    const client = new Client(requestUrl.origin);
    const lastModifiedHash = upstreamMeta.lastModified.replace(/[^\d]+/g, '_');
    const downloadFilePath = `${downloadDir}/${this.ckanId}_${lastModifiedHash}.zip`;
    if (fs.existsSync(downloadFilePath)) {
      const stats = await fs.promises.stat(downloadFilePath);

      progressBar?.start(stats.size, 0);
      progressBar?.update(stats.size);
      progressBar?.stop();
      return downloadFilePath;
    }
  
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
      progressBar?.start(contentLength, 0);
 
      const writerStream = fs.createWriteStream(downloadFilePath);
      const writable = new Transform({
        transform(chunk, encoding, callback) {
          progressBar?.increment(chunk.length);
          callback(null, chunk);
        },
        destroy(error, callback) {
          writerStream.end();
          progressBar?.stop();
          callback(null);
        },
      });
      writable.pipe(writerStream);
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

    return downloadFilePath;
  }
}
