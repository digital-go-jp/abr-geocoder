import { PackageInfo, parsePackageId } from "@domain/services/parse-package-id";
import { Sqlite3Params } from "@domain/types/database-params";
import { AbrgError, AbrgErrorLevel } from "@domain/types/messages/abrg-error";
import { AbrgMessage } from "@domain/types/messages/abrg-message";
import { HttpRequestAdapter } from "@interface/http-request-adapter";
import { DownloaderOptions } from "@usecases/download/download-process";
import { DownloadDiContainer } from "@usecases/download/models/download-di-container";
import { StatusCodes } from "http-status-codes";
import fs from 'node:fs';
import path from 'node:path';
import { Stream } from "stream";
import { pipeline } from "stream/promises";
import { UpdateCheckResult, UpdateCheckTransform } from "./models/update-check-transform";
import { CounterWritable } from "@domain/services/counter-writable";
import { isPrefLgCode, PrefLgCode } from "@domain/types/pref-lg-code";


export type UpdateCheckOptions = {
  // 進み具合を示すプログレスのコールバック
  progress?: (current: number, total: number) => void;
};

export class UpdateChecker {

  private client: HttpRequestAdapter;

  private container: DownloadDiContainer;

  constructor(options: DownloaderOptions) {
    this.container = new DownloadDiContainer({
      cacheDir: options.cacheDir,
      downloadDir: options.downloadDir,
      database: options.database,
    });

    this.client = new HttpRequestAdapter({
      hostname: this.container.env.hostname,
      userAgent: this.container.env.userAgent,
      peerMaxConcurrentStreams: 200,
    });
  }

  async updateCheck(options: UpdateCheckOptions) {
    // レジストリ・カタログサーバーから、パッケージの一覧を取得する
    const response = await this.client.getJSON({
      url: `https://${this.container.env.hostname}/rc/api/3/action/package_list`,
    });

    if (response.header.statusCode !== StatusCodes.OK) {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_GET_PACKAGE_LIST,
        level: AbrgErrorLevel.ERROR
      });
    }

    const packageListResult = response.body as {
      success: boolean;
      result: string[];
    };

    if (!packageListResult.success) {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_GET_PACKAGE_LIST,
        level: AbrgErrorLevel.ERROR
      });
    }
  
    // リストからジオコーディングに関するパッケージIDのみをピックアップ
    const packages = packageListResult.result
      .map(packageId => parsePackageId(packageId))
      .filter(x => x !== undefined)
      .filter(x => {
        if (!isPrefLgCode(x.lgCode)) {
          return true;
        }
        if (x.lgCode === PrefLgCode.ALL) {
          return x.dataset.startsWith('pref');
        }
        return x.dataset.startsWith('city');
      });

    // アップデートが必要なパッケージを保持
    const updatedPackageIDs: PackageInfo[] = [];

    // 各パッケージIDをチェック
    const total = packages.length;
    const dst = new CounterWritable({
      write: (result: UpdateCheckResult, _, callback) => {
        // プログレスバーに進捗を出力する
        if (options.progress) {
          setImmediate(() => options.progress && options.progress(dst.count, total));
        }
        if (result.needUpdate) {
          updatedPackageIDs.push(result.packageInfo)
        }
        callback();
      },
    });

    // Stream で処理する
    const reader = Stream.Readable.from(packages, {
      objectMode: true,
    });

    const checker = new UpdateCheckTransform({
      commonDbSqlite: path.join((this.container.database.connectParams as Sqlite3Params).dataDir, 'common.sqlite'),
      container: this.container,
    });

    await pipeline(
      reader,
      checker,
      dst,
    );

    this.client.close();

    return updatedPackageIDs;
  }
}