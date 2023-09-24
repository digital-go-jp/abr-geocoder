import { Database } from 'better-sqlite3';
import { StatusCodes } from 'http-status-codes';
import EventEmitter from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import stringHash from 'string-hash';
import { Client, Dispatcher, request } from 'undici';
import {
  AbrgError,
  AbrgErrorLevel,
  AbrgMessage,
  CKANPackageShow,
  CKANResponse,
  DatasetMetadata
} from '../../domain/';

export interface CkanDownloaderParams {
  userAgent: string;
  datasetUrl: string;
  db: Database;
  ckanId: string;
  dataDir: string;
}

export class CkanDownloader extends EventEmitter {
  private readonly userAgent: string;
  private readonly datasetUrl: string;
  private readonly db: Database;
  private readonly ckanId: string;
  private readonly dataDir: string;
  private cacheMetadata : DatasetMetadata | null = null;

  constructor({
    userAgent,
    datasetUrl,
    db,
    ckanId,
    dataDir,
  }: CkanDownloaderParams) {
    super();
    this.userAgent = userAgent;
    this.datasetUrl = datasetUrl;
    this.db = db;
    this.ckanId = ckanId;
    this.dataDir = dataDir;
  }

  private async ifNoneMatch(metadata: DatasetMetadata): Promise<boolean> {
    const response = await this.headRequest(metadata.fileUrl, {
      'If-None-Match': metadata.etag,
    });
    return response.statusCode !== StatusCodes.NOT_MODIFIED;
  }

  async getDatasetMetadata(): Promise<DatasetMetadata> {
    if (this.cacheMetadata) {
      return this.cacheMetadata;
    }
    
    // ABRのデータセットから情報を取得
    const abrResponse = await this.getRequest(this.datasetUrl);

    if (abrResponse.statusCode !== StatusCodes.OK) {
      throw new AbrgError({
        messageId: AbrgMessage.DATA_DOWNLOAD_ERROR,
        level: AbrgErrorLevel.ERROR,
      });
    }

    // APIレスポンスのパース
    const metaWrapper = (await abrResponse.body.json()) as CKANResponse<CKANPackageShow>;
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

    const csvMeta = this.getValueWithKey(this.ckanId);

    // APIレスポンスには etag や ファイルサイズが含まれていないので、
    // csvファイルに対して HEADリクエストを送る
    const csvResponse = await this.headRequest(csvResource.url, {
      'If-None-Match': csvMeta?.etag,
    });

    switch(csvResponse.statusCode) {
      case StatusCodes.OK:
        const newCsvMeta = new DatasetMetadata({
          fileUrl: csvResource.url,
          etag: csvResponse.headers['etag'] as string,
          contentLength: parseInt(csvResponse.headers['content-length'] as string),
          lastModified: csvResponse.headers['last-modified'] as string,
        });
        return newCsvMeta;
      
      case StatusCodes.NOT_MODIFIED:
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
    const ckanIdMeta = this.getValueWithKey(this.ckanId);
    if (!ckanIdMeta) {
      return true;
    }
    const downloadFilePath = this.getDownloadFilePath();
    if (!fs.existsSync(downloadFilePath)) {
      return true;
    }
    const stat = await fs.promises.stat(downloadFilePath);
    const startAt = stat.size - 1024;
    const response = await this.getRequest(ckanIdMeta.fileUrl, {
      'Range': `bytes=${startAt}-`,
    });

    if (response.statusCode !== StatusCodes.PARTIAL_CONTENT) {
      return true;
    }

    const contentLength = parseInt((response.headers['content-range'] as string).split('/')[1]);
    if (contentLength !== stat.size) {
        return true;
    }

    const fileLast1k = Buffer.alloc(1024);
    const fd = await fs.promises.open(downloadFilePath, 'r');
    await fd.read(fileLast1k, 0, 1024, startAt);
    fd.close();

    const arrayBuffer = await response.body.arrayBuffer();
    const recvLast1k = Buffer.from(arrayBuffer);
    return Buffer.compare(
      fileLast1k,
      recvLast1k,
    ) !== 0;
  }

  private getDownloadFilePath(): string {
    return path.join(this.dataDir, `${this.ckanId}.zip`);
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
        return [
          0,
          await fs.promises.open(downloadFilePath, 'w'),
        ];
      }

      const stat = fs.statSync(dst);
      return [
        stat.size,
        await fs.promises.open(downloadFilePath, 'a+'),
      ];
    })(downloadFilePath);
    
    const downloader = this;
    let fsPointer = startAt;
    const fsWritable = new Writable({
      write(chunk: Buffer, encoding, callback) {
        fd.write(chunk, 0, chunk.byteLength, fsPointer);
        fsPointer += chunk.byteLength;
        downloader.emit('download:data', chunk.byteLength);
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
            'Range': `bytes=${startAt}-`
          },
          signal: abortController.signal,
        },
        ({statusCode, headers}) => {
          switch (statusCode) {
            case StatusCodes.OK: {
  
              fsPointer = 0;
              const newCsvMeta = new DatasetMetadata({
                fileUrl: metadata.fileUrl,
                etag: headers['etag'] as string,
                contentLength: parseInt(headers['content-length'] as string),
                lastModified: headers['last-modified'] as string,
              });
  
              this.saveKeyAndValue(this.ckanId, newCsvMeta);
              downloader.emit('download:start', {
                position: 0,
                length: metadata.contentLength,
              });
              break;
            }
            
            case StatusCodes.PARTIAL_CONTENT: {
              fsPointer = startAt;
              const contentLength = parseInt((headers['content-range'] as string).split('/')[1]);

              const newCsvMeta = new DatasetMetadata({
                fileUrl: metadata.fileUrl,
                etag: headers['etag'] as string,
                contentLength,
                lastModified: headers['last-modified'] as string,
              });
  
              this.saveKeyAndValue(this.ckanId, newCsvMeta);
  
              downloader.emit('download:start', {
                position: startAt,
                length: metadata.contentLength,
              });
              break;
            }
            
            case StatusCodes.NOT_MODIFIED: {
              fsPointer = metadata.contentLength;
  
              downloader.emit('download:start', {
                position: metadata.contentLength,
                length: metadata.contentLength,
              });
              abortController.abort(statusCode);
              break
            }
  
            default: {
              abortController.abort(statusCode);
              break;
            }
          }
  
          return fsWritable;
        }
      );
      return downloadFilePath;

    } catch (e) {
      console.error(e);
      return null;

    } finally {
      fd.close();
      this.emit('download:end');
    }
  }
  

  private async headRequest(
    url: string,
    headers?: { [key: string]: string | undefined },
  ): Promise<Dispatcher.ResponseData> {
    return await request(
      url,
      {
        headers: {
          'user-agent': this.userAgent,
          ...headers,
        },
        method: 'HEAD',
      }
    );
  }

  private async getRequest(
    url: string,
    headers?: { [key: string]: string | undefined},
  ): Promise<Dispatcher.ResponseData> {
    return await request(
      url,
      {
        headers: {
          'user-agent': this.userAgent,
          ...headers,
        },
      }
    );
  }

  private getValueWithKey(key: string): DatasetMetadata | undefined {
    const result = this.db
      .prepare(
        `select value from metadata where key = @key limit 1`
      )
      .get({
        key: stringHash(key),
      }) as
      | {
          value: string;
        }
      | undefined;
    if (!result) {
      return;
    }
    return DatasetMetadata.from(result.value);
  }

  private saveKeyAndValue(key: string, value: DatasetMetadata) {
    this.db.prepare(
      `insert or replace into metadata values(@key, @value)`
    ).run({
      key: stringHash(key),
      value: value.toString(),
    });
  }
}
