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
import { PackageInfo } from "@domain/services/parse-package-id";
import { CkanPackageResponse, CkanResource } from "@domain/types/download/ckan-package";
import { isPrefLgCode } from "@domain/types/pref-lg-code";
import { ICommonDbUpdateCheck } from "@drivers/database/common-db";
import { HttpRequestAdapter } from "@interface/http-request-adapter";
import { StatusCodes } from "http-status-codes";
import timers from 'node:timers/promises';
import { Duplex, TransformCallback } from "stream";
import { UpdateCheckDiContainer } from "./update-check-di-container";

export type UpdateCheckResult = {
  needUpdate: boolean;
  packageInfo: PackageInfo;
};

export class UpdateCheckTransform extends Duplex {
  private receiveFinal: boolean = false;
  private numOfRunning: number = 0;

  private constructor(
    private readonly commonDb: ICommonDbUpdateCheck,
    private readonly client: HttpRequestAdapter,
    private readonly container: UpdateCheckDiContainer,
  ) {
    super({
      objectMode: true,
      allowHalfOpen: true,
      read() {},
    });

    this.container = container;
  
  }
  
  async _write(packageInfo: PackageInfo, _: BufferEncoding, callback: TransformCallback) {
    this.numOfRunning++;
    
    // 処理が溜まっている場合は少し待つ
    while (this.numOfRunning > 200) {
      await timers.setTimeout(50 + Math.random() * 100);
      if (this.numOfRunning <= 100) {
        break;
      }
    }

    // 並行処理でチェックしたいので、先にCallbackを呼ぶ
    // 結果は push() で次に渡す
    callback(null);

    switch (packageInfo.dataset) {
      case 'pref':
      case 'pref_pos': {
        const result = await this.checkPrefDataset(packageInfo);
        this.push(result);
        break;
      }

      case 'city':
      case 'city_pos': {
        const result = await this.checkCityDataset(packageInfo);
        this.push(result);
        break;
      }

      case 'town':
      case 'town_pos': {
        const result = await this.checkTownDataset(packageInfo);
        this.push(result);
        break;
      }

      case 'rsdtdsp_blk':
      case 'rsdtdsp_blk_pos':
      case 'parcel':
      case 'parcel_pos':
      case 'rsdtdsp_rsdt':
      case 'rsdtdsp_rsdt_pos': {
      // キャッシュを使って、リソースが更新されているかチェック
        const needUpdate = await this.needsCacheUpdate(packageInfo.packageId);
        const result = {
          needUpdate,
          packageInfo,
        };
        this.push(result);
        break;
      }

      default: {
      // 対象外の packageId なのでスキップする
        const result = {
          needUpdate: false,
          packageInfo,
        };
        this.push(result);
        break;
      }
    }
    this.numOfRunning--;

    // 全部終了したかチェック
    if (this.receiveFinal && this.numOfRunning === 0) {
      this.client.close();
      this.push(null);
    }
  }

  private async checkTownDataset(packageInfo: PackageInfo) {
    try {
      // Townテーブルに1行あるかどうかチェック
      const existTownRows = await this.commonDb.hasTownRows(packageInfo);
      console.error(`existTownRows = ${existTownRows}`);
    
      // 0行なら、アップデートが必要
      if (!existTownRows) {
        return {
          needUpdate: true,
          packageInfo,
        };
      }

      // キャッシュを使って、リソースが更新されているかチェック
      const needUpdate = await this.needsCacheUpdate(packageInfo.packageId);
      return {
        needUpdate,
        packageInfo,
      };
    } catch (_) {
      // SQLエラー（そもそもテーブルが無いなど）のときは、更新が必要
      return {
        needUpdate: true,
        packageInfo,
      };
    }
  }

  private async checkCityDataset(packageInfo: PackageInfo) {
    if (!isPrefLgCode(packageInfo.lgCode)) {
      try {
        // Cityテーブルの行数をチェック(1行あれば良い)
        const existCityRow = await this.commonDb.hasCityRows(packageInfo);
        console.error(`existCityRow = ${existCityRow}`);

        // 0行なら、アップデートが必要
        if (!existCityRow) {
          return {
            needUpdate: true,
            packageInfo,
            reason: 'no row',
          };
        }
      } catch(_) {
        // SQLエラー（そもそもテーブルが無いなど）のときは、更新が必要
        return {
          needUpdate: true,
          packageInfo,
        };
      }
    }

    // キャッシュを使って、リソースが更新されているかチェック
    const needUpdate = await this.needsCacheUpdate(packageInfo.packageId);
    return {
      needUpdate,
      packageInfo,
      reason: 'needUpdate',
    };
  }

  private async checkPrefDataset(packageInfo: PackageInfo) {
    // Prefテーブルの行数をチェック(1行あれば良い)
    try {
      const existPrefRows = await this.commonDb.hasPrefRows();
      console.error(`existPrefRows = ${existPrefRows}`);
      
      // 0行なら、アップデートが必要
      if (!existPrefRows) {
        return {
          needUpdate: true,
          packageInfo,
        };
      }
      
      // キャッシュを使って、リソースが更新されているかチェック
      const needUpdate = await this.needsCacheUpdate(packageInfo.packageId);
      return {
        needUpdate,
        packageInfo,
      };
    } catch (_) {
      // SQLエラー（そもそもテーブルが無いなど）のときは、更新が必要
      return {
        needUpdate: true,
        packageInfo,
      };
    }
  }

  private async needsCacheUpdate(packageId: string) {
    
    // リソースのURL
    const packageInfoUrl = this.getFileShowUrl(packageId);

    // メタデータを取得
    const packageResponse = await this.client.getJSON({
      url: packageInfoUrl,
    });

    // リソースが利用できない (404 Not found)
    if (packageResponse.header.statusCode !== StatusCodes.OK) {
      return false;
    }

    // CSVファイルのURLを抽出する
    const packageInfo = packageResponse.body as unknown as CkanPackageResponse<string>;
    let csvMeta: CkanResource<URL> | undefined;
    if (packageInfo && packageInfo.result) {
      csvMeta = packageInfo.result!.resources
        .map(x => {
          return Object.assign(x, {
            url: new URL(x.url),
          });
        })
        .find(x =>
          x.format.toLowerCase().startsWith('csv'),
        );
    }

    // CSVがない (予防的なコード)
    if (!csvMeta) {
      return false;
    }
    
    // URLに対するハッシュ文字列の生成
    // キャッシュを利用できるか確認するcd
    const datasetDb = await this.container.database.openDatasetDb();
    const cache = await datasetDb.readUrlCache(csvMeta.url);
    if (!cache || !cache.etag) {
      // キャッシュファイルが見つからないので、アップデートが必要
      return true;
    }

    // ETagによるチェック
    const headers: {
      'if-none-match': string | undefined;
    } = {
      'if-none-match': cache.etag,
    };
    const headResponse = await this.client.headRequest({
      url: csvMeta.url,
      headers,
    });

    // サーバーがETagを検証した結果を利用する
    // (ファイルの有無は、ここでは問わない)
    // NOT_MODIFIED でなければ、更新が必要
    return headResponse.header.statusCode !== StatusCodes.NOT_MODIFIED;
  }

  private getFileShowUrl(packageId: string): URL {
    const fileShowUrl = this.container.getFileShowUrl();
    return new URL(`${fileShowUrl}?id=${packageId}`);
  }

  _final(callback: (error?: Error | null) => void): void {
    this.receiveFinal = true;
    callback();
  }

  static create = async (container: UpdateCheckDiContainer) => {
    const commonDb = await container.database.openCommonDb();

    const client = new HttpRequestAdapter({
      hostname: container.env.hostname,
      userAgent: container.env.userAgent,
      peerMaxConcurrentStreams: 100,
    });

    return new UpdateCheckTransform(commonDb, client, container);
  };
}
    
