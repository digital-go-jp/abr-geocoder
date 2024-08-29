/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { CounterWritable } from "@domain/services/counter-writable";
import { PackageInfo, parsePackageId } from "@domain/services/parse-package-id";
import { Sqlite3Params } from "@domain/types/database-params";
import { AbrgError, AbrgErrorLevel } from "@domain/types/messages/abrg-error";
import { AbrgMessage } from "@domain/types/messages/abrg-message";
import { isPrefLgCode, PrefLgCode } from "@domain/types/pref-lg-code";
import { HttpRequestAdapter } from "@interface/http-request-adapter";
import { DownloaderOptions } from "@usecases/download/download-process";
import { StatusCodes } from "http-status-codes";
import path from 'node:path';
import { Stream } from "stream";
import { pipeline } from "stream/promises";
import { UpdateCheckDiContainer, UpdateCheckDiContainerParams } from "./models/update-check-di-container";
import { UpdateCheckResult, UpdateCheckTransform } from "./models/update-check-transform";


export type UpdateCheckOptions = {
  // 進み具合を示すプログレスのコールバック
  progress?: (current: number, total: number) => void;
};

export class UpdateChecker {

  private client: HttpRequestAdapter;

  private container: UpdateCheckDiContainer;

  constructor(options: UpdateCheckDiContainerParams) {

    this.container = new UpdateCheckDiContainer(options);

    this.client = new HttpRequestAdapter({
      hostname: this.container.env.hostname,
      userAgent: this.container.env.userAgent,
      peerMaxConcurrentStreams: 200,
    });
  }

  async updateCheck(options: UpdateCheckOptions) {
    // データベースから、対象の lgCodeを取得する
    const commonDb = await this.container.database.openCommonDb();
    const lgCodes = await commonDb.getLgCodes();
    const lgCodeSet = new Set<string>(lgCodes);

    // レジストリ・カタログサーバーから、パッケージの一覧を取得する
    const response = await this.client.getJSON({
      url: this.container.getPackageListUrl(),
    });

    if (response.header.statusCode !== StatusCodes.OK) {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_GET_PACKAGE_LIST,
        level: AbrgErrorLevel.ERROR,
      });
    }

    const packageListResult = response.body as unknown as {
      success: boolean;
      result: string[];
    };

    if (!packageListResult.success) {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_GET_PACKAGE_LIST,
        level: AbrgErrorLevel.ERROR,
      });
    }
  
    // リストからジオコーディングに関するパッケージIDのみをピックアップ
    const lgCodeFilter = (() => {
      if (lgCodeSet.size === 0) {
        return (_: PackageInfo) => true;
      }
      return (x: PackageInfo) => lgCodeSet.has(x.lgCode);
    })();
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
      })
      .filter(lgCodeFilter);

    const total = packages.length;

    // アップデートが必要なパッケージを保持
    const updatedPackageIDs: PackageInfo[] = [];

    // 各パッケージIDをチェック
    const dst = new CounterWritable<UpdateCheckResult>({
      write: (result: UpdateCheckResult, _, callback) => {
        // プログレスバーに進捗を出力する
        if (options.progress) {
          setImmediate(() => options.progress && options.progress(dst.count, total));
        }
        if (result.needUpdate) {
          updatedPackageIDs.push(result.packageInfo);
        }
        callback();
      },
    });

    // Stream で処理する
    const reader = Stream.Readable.from(packages, {
      objectMode: true,
    });

    const checker = await UpdateCheckTransform.create(this.container);

    console.error(`total = ${packages.length}`);
    await pipeline(
      reader,
      checker,
      dst,
    );

    this.client.close();

    return updatedPackageIDs;
  }
}
