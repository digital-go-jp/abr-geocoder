import fs from 'node:fs';
import {
  ArchiveMetadata,
  CKANPackageShow,
  CKANResponse,
  CheckForUpdatesOutput,
  DatasetMetadata,
  IArchiveMeta,
} from '../types';
import type BetterSqlite3 from 'better-sqlite3';
import Database from 'better-sqlite3';
import {SingleBar} from 'cli-progress';
import prettyBytes from 'pretty-bytes';
import {Client, Dispatcher} from 'undici';
import {Writable} from 'node:stream';

export interface CkanDownloaderOptions {
  ckanId: string;
  sqlitePath: string;
  ckanBaseUrl: string;
  userAgent: string;
  silent: boolean;
}

export class CkanDownloader {
  private readonly ckanId: string;
  private readonly ckanBaseUrl: string;
  private readonly userAgent: string;
  private readonly db: BetterSqlite3.Database;
  private readonly silent: boolean;
  constructor({
    ckanId,
    sqlitePath,
    ckanBaseUrl,
    userAgent,
    silent = false,
  }: CkanDownloaderOptions) {
    this.ckanId = ckanId;
    this.ckanBaseUrl = ckanBaseUrl;
    this.userAgent = userAgent;
    this.silent = silent;

    this.db = new Database(sqlitePath);
  }

  private getDatasetUrl(): string {
    return `${this.ckanBaseUrl}/api/3/action/package_show?id=${this.ckanId}`;
  }

  private async getDatasetMetadata(): Promise<DatasetMetadata> {
    const metaResp = await fetch(this.getDatasetUrl(), {
      headers: {
        'user-agent': this.userAgent,
      },
    });

    if (!metaResp.ok) {
      const body = await metaResp.text();
      this.printError(`Body: ${body}`);
      throw new Error(
        `${this.ckanId} を読み込むときに失敗しました。もう一度お試してください。 
        (HTTP: ${metaResp.status} ${metaResp.statusText})`
      );
    }

    const metaWrapper =
      (await metaResp.json()) as CKANResponse<CKANPackageShow>;
    if (metaWrapper.success === false) {
      throw new Error(
        `${this.ckanId} を読み込むときに失敗しました。もう一度お試してください。`
      );
    }

    const meta = metaWrapper.result;
    const csvResource = meta.resources.find(x =>
      x.format.toLowerCase().startsWith('csv')
    );

    if (!csvResource) {
      throw new Error(
        `${this.ckanId} に該当のCSVリソースが見つかりませんでした。ご確認ください: ${this.ckanBaseUrl}/dataset/${this.ckanId}`
      );
    }

    return {
      fileUrl: csvResource.url,
      lastModified: csvResource.last_modified,
    };
  }

  private async getArchiveMetadata(): Promise<ArchiveMetadata> {
    const allMetadata = this.db
      .prepare('SELECT "key", "value" FROM "metadata"')
      .all() as IArchiveMeta[];

    const result: ArchiveMetadata = {};
    allMetadata.forEach((row: IArchiveMeta) => {
      result[row.key] = row.value;
    });

    return result;
  }

  async updateCheck(): Promise<CheckForUpdatesOutput> {
    const upstreamMeta = await this.getDatasetMetadata();
    const currentArchiveMeta = await this.getArchiveMetadata();

    // we'll test to see if the modified date we have in our archive is earlier
    // than the newest modified date in the archive.
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

  private printError(...args: string[]) {
    if (this.silent) {
      return;
    }
    console.error(...args);
  }
  private print(...args: string[]) {
    if (this.silent) {
      return;
    }
    console.log(...args);
  }

  private createProgressBar(): SingleBar {
    return new SingleBar({
      format: ' {bar} {percentage}% | ETA: {eta_formatted} | {value}/{total}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      etaBuffer: 30,
      fps: 2,
      formatValue: (v, options, type) => {
        if (type === 'value' || type === 'total') {
          return prettyBytes(v);
        }

        // no autopadding ? passthrough
        if (options.autopadding !== true) {
          return v.toString();
        }

        // padding
        function autopadding(value: number, length: number) {
          return ((options.autopaddingChar || ' ') + value).slice(-length);
        }

        switch (type) {
          case 'percentage':
            return autopadding(v, 3);

          default:
            return v.toString();
        }
      },
    });
  }

  async download({
    upstreamMeta,
    outputFile,
  }: {
    upstreamMeta: DatasetMetadata;
    outputFile: string;
  }): Promise<Boolean> {
    const requestUrl = new URL(upstreamMeta.fileUrl);

    // perform the download
    this.print(`ダウンロード開始: ${requestUrl.toString()} → ${outputFile}`);
    const progress = this.silent ? null : this.createProgressBar();
    const client = new Client(requestUrl.origin);

    const streamFactory: Dispatcher.StreamFactory = ({statusCode, headers}) => {
      if (statusCode !== 200) {
        throw new Error('アクセスできませんでした');
      }
      const decimal = 10;
      const contentLength = parseInt(
        headers['content-length']!.toString(),
        decimal
      );

      progress?.start(contentLength, 0);

      const writerStream = fs.createWriteStream(outputFile);

      const result = new Writable({
        write(chunk, _, callback) {
          if (chunk.length > 0) {
            progress?.increment(chunk.length);
            progress?.updateETA();
          }
          writerStream.write(chunk);
          callback();
        },
      });

      result.on('end', () => {
        writerStream.end();
        progress?.stop();
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
