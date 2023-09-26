import { Database } from 'better-sqlite3';
import { StatusCodes } from 'http-status-codes';
import EventEmitter from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import { Client } from 'undici';
import {
  AbrgError,
  AbrgErrorLevel,
  AbrgMessage,
  CKANPackageShow,
  CKANResponse,
  DatasetMetadata,
  getValueWithKey,
  saveKeyAndValue,
} from '../../domain';
import { getRequest, headRequest } from '../../domain/http';

export interface CkanDownloaderParams {
  userAgent: string;
  datasetUrl: string;
  db: Database;
  ckanId: string;
  dstDir: string;
}

export class CkanDownloader extends EventEmitter {
  private readonly userAgent: string;
  private readonly datasetUrl: string;
  private readonly db: Database;
  private readonly ckanId: string;
  private readonly dstDir: string;
  private cacheMetadata: DatasetMetadata | null = null;

  constructor({
    userAgent,
    datasetUrl,
    db,
    ckanId,
    dstDir,
  }: CkanDownloaderParams) {
    super();
    this.userAgent = userAgent;
    this.datasetUrl = datasetUrl;
    this.db = db;
    this.ckanId = ckanId;
    this.dstDir = dstDir;
  }

  async getDatasetMetadata(): Promise<DatasetMetadata> {
    if (this.cacheMetadata) {
      return this.cacheMetadata;
    }

    // ABRのデータセットから情報を取得
    const abrResponse = await getRequest({
      url: this.datasetUrl,
      userAgent: this.userAgent,
    });

    if (abrResponse.statusCode !== StatusCodes.OK) {
      throw new AbrgError({
        messageId: AbrgMessage.DATA_DOWNLOAD_ERROR,
        level: AbrgErrorLevel.ERROR,
      });
    }

    // APIレスポンスのパース
    const metaWrapper =
      (await abrResponse.body.json()) as CKANResponse<CKANPackageShow>;
    if (metaWrapper.success === false) {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_FIND_THE_SPECIFIED_RESOURCE,
        level: AbrgErrorLevel.ERROR,
      });
    }

    // CSVファイルのURLを特定
    const meta = metaWrapper.result;
    const csvResource = meta.resources.find(x =>
      x.format.toLowerCase().startsWith('csv')
    );

    if (!csvResource) {
      throw new AbrgError({
        messageId:
          AbrgMessage.DOWNLOADED_DATA_DOES_NOT_CONTAIN_THE_RESOURCE_CSV,
        level: AbrgErrorLevel.ERROR,
      });
    }

    const csvMeta = (() => {
      const csvMetaStr = getValueWithKey({
        db: this.db,
        key: this.ckanId,
      });
      if (!csvMetaStr) {
        return null;
      }
      return DatasetMetadata.from(csvMetaStr);
    })();

    // APIレスポンスには etag や ファイルサイズが含まれていないので、
    // csvファイルに対して HEADリクエストを送る
    const csvResponse = await headRequest({
      url: csvResource.url,
      userAgent: this.userAgent,
      headers: {
        'If-None-Match': csvMeta?.etag,
      },
    });

    switch (csvResponse.statusCode) {
      case StatusCodes.OK: {
        const newCsvMeta = new DatasetMetadata({
          contentLength: parseInt(
            csvResponse.headers['content-length'] as string
          ),
          etag: csvResponse.headers['etag'] as string,
          fileUrl: csvResource.url,
          lastModified: csvResponse.headers['last-modified'] as string,
        });
        this.cacheMetadata = newCsvMeta;
        return newCsvMeta;
      }

      case StatusCodes.NOT_MODIFIED:
        this.cacheMetadata = csvMeta;
        return csvMeta!;

      default:
        throw new AbrgError({
          messageId:
            AbrgMessage.DOWNLOADED_DATA_DOES_NOT_CONTAIN_THE_RESOURCE_CSV,
          level: AbrgErrorLevel.ERROR,
        });
    }
  }

  async updateCheck(): Promise<boolean> {
    const csvMetaStr = getValueWithKey({
      db: this.db,
      key: this.ckanId,
    });
    if (!csvMetaStr) {
      return true;
    }
    const csvMeta = DatasetMetadata.from(csvMetaStr);

    const downloadFilePath = this.getDownloadFilePath();
    if (!fs.existsSync(downloadFilePath)) {
      return true;
    }
    const stat = await fs.promises.stat(downloadFilePath);
    const startAt = stat.size - 1024;
    const response = await getRequest({
      url: csvMeta.fileUrl,
      userAgent: this.userAgent,
      headers: {
        Range: `bytes=${startAt}-`,
      },
    });

    if (response.statusCode !== StatusCodes.PARTIAL_CONTENT) {
      return true;
    }

    const contentLength = parseInt(
      (response.headers['content-range'] as string).split('/')[1]
    );
    if (contentLength !== stat.size) {
      return true;
    }

    const fileLast1k = Buffer.alloc(1024);
    const fd = await fs.promises.open(downloadFilePath, 'r');
    await fd.read(fileLast1k, 0, 1024, startAt);
    fd.close();

    const arrayBuffer = await response.body.arrayBuffer();
    const recvLast1k = Buffer.from(arrayBuffer);
    return Buffer.compare(fileLast1k, recvLast1k) !== 0;
  }

  private getDownloadFilePath(): string {
    return path.join(this.dstDir, `${this.ckanId}.zip`);
  }

  /**
   *
   * @param param download parameters
   * @returns The file hash of downloaded file.
   */
  async download(): Promise<string | null> {
    const downloadFilePath = this.getDownloadFilePath();
    const metadata = await this.getDatasetMetadata();
    const requestUrl = new URL(metadata.fileUrl);
    const client = new Client(requestUrl.origin);
    const [startAt, fd] = await (async (dst: string) => {
      if (!metadata || !metadata.etag || !fs.existsSync(dst)) {
        return [0, await fs.promises.open(downloadFilePath, 'w')];
      }

      const stat = fs.statSync(dst);
      return [stat.size, await fs.promises.open(downloadFilePath, 'a+')];
    })(downloadFilePath);

    if (startAt === metadata?.contentLength) {
      return downloadFilePath;
    }

    const downloaderEmit = this.emit;

    let fsPointer = startAt;
    const fsWritable = new Writable({
      write(chunk: Buffer, encoding, callback) {
        fd.write(chunk, 0, chunk.byteLength, fsPointer);
        fsPointer += chunk.byteLength;
        downloaderEmit('download:data', chunk.byteLength);
        callback();
      },
    });

    const abortController = new AbortController();
    try {
      await client.stream(
        {
          path: requestUrl.pathname,
          method: 'GET',
          headers: {
            'user-agent': this.userAgent,
            'If-Range': metadata.etag,
            Range: `bytes=${startAt}-`,
          },
          signal: abortController.signal,
        },
        ({ statusCode, headers }) => {
          switch (statusCode) {
            case StatusCodes.OK: {
              fsPointer = 0;
              const newCsvMeta = new DatasetMetadata({
                fileUrl: metadata.fileUrl,
                etag: headers['etag'] as string,
                contentLength: parseInt(headers['content-length'] as string),
                lastModified: headers['last-modified'] as string,
              });
              saveKeyAndValue({
                db: this.db,
                key: `download:${this.ckanId}`,
                value: newCsvMeta.toString(),
              });

              downloaderEmit('download:start', {
                position: 0,
                length: metadata.contentLength,
              });
              break;
            }

            case StatusCodes.PARTIAL_CONTENT: {
              fsPointer = startAt;
              const contentLength = parseInt(
                (headers['content-range'] as string).split('/')[1]
              );

              const newCsvMeta = new DatasetMetadata({
                fileUrl: metadata.fileUrl,
                etag: headers['etag'] as string,
                contentLength,
                lastModified: headers['last-modified'] as string,
              });

              saveKeyAndValue({
                db: this.db,
                key: `download:${this.ckanId}`,
                value: newCsvMeta.toString(),
              });

              downloaderEmit('download:start', {
                position: startAt,
                length: metadata.contentLength,
              });
              break;
            }

            case StatusCodes.NOT_MODIFIED: {
              fsPointer = metadata.contentLength;

              downloaderEmit('download:start', {
                position: metadata.contentLength,
                length: metadata.contentLength,
              });
              abortController.abort(statusCode);
              break;
            }

            default: {
              throw new AbrgError({
                messageId: AbrgMessage.DOWNLOAD_ERROR,
                level: AbrgErrorLevel.ERROR,
              });
            }
          }

          return fsWritable;
        }
      );
      return downloadFilePath;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return downloadFilePath;
      }
      console.error(err);
      return null;
    } finally {
      fd.close();
      this.emit('download:end');
    }
  }
}
