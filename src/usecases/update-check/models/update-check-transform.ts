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
import { DbTableName } from "@config/db-table-name";
import { getUrlHash } from "@domain/services/get-url-hash";
import { PackageInfo } from "@domain/services/parse-package-id";
import { TableKeyProvider } from "@domain/services/table-key-provider";
import { CkanPackageResponse, CkanResource } from "@domain/types/download/ckan-package";
import { isPrefLgCode } from "@domain/types/pref-lg-code";
import { HttpRequestAdapter } from "@interface/http-request-adapter";
import { DownloadDiContainer } from "@usecases/download/models/download-di-container";
import BetterSqlite3 from "better-sqlite3";
import { StatusCodes } from "http-status-codes";
import timers from 'node:timers/promises';
import { Duplex, TransformCallback } from "stream";

export type UpdateCheckResult = {
  needUpdate: boolean;
  packageInfo: PackageInfo;
};

export class UpdateCheckTransform extends Duplex {
  private readonly commonDb: BetterSqlite3.Database;
  private container: DownloadDiContainer;
  private client: HttpRequestAdapter;
  private receiveFinal: boolean = false;
  private numOfRunning: number = 0;

  constructor(params: {
    commonDbSqlite : string;
    container: DownloadDiContainer;
  }) {
    super({
      objectMode: true,
      allowHalfOpen: true,
      read() {},
    });
    this.commonDb = new BetterSqlite3(params.commonDbSqlite);

    this.container = params.container;
  
    this.client = new HttpRequestAdapter({
      hostname: this.container.env.hostname,
      userAgent: this.container.env.userAgent,
      peerMaxConcurrentStreams: 100,
    });
  }
  
  async _write(packageInfo: PackageInfo, _: BufferEncoding, callback: TransformCallback) {
    this.numOfRunning++;
    
    while (this.numOfRunning > 200) {
      await timers.setTimeout(200);
      if (this.numOfRunning <= 100) {
        break;
      }
    }
    callback(null);
    // 並行処理でチェックしたいので、先にCallbackを呼ぶ
    // 結果は push() で次に渡す

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

    if (this.receiveFinal && this.numOfRunning === 0) {
      this.client.close();
      this.push(null);
    }
  }

  private async checkTownDataset(packageInfo: PackageInfo) {
    try {
      // Townテーブルに1行あるかどうかチェック
      const sql = `select count(city_key) as count FROM ${DbTableName.TOWN} where city_key = @city_key limit 1`;
      const city_key = TableKeyProvider.getCityKey({
        lg_code: packageInfo.lgCode,
      });
      const row = this.commonDb.prepare<unknown[], {
        count: number;
      }>(sql)
        .get({
          city_key,
        });
      
      // 0行なら、アップデートが必要
      if (!row || row.count === 0) {
        return {
          needUpdate: true,
          packageInfo,
        };
      }
    } catch (_) {
      // SQLエラー（そもそもテーブルが無いなど）のときは、更新が必要
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
  }

  private async checkCityDataset(packageInfo: PackageInfo) {
    if (!isPrefLgCode(packageInfo.lgCode)) {
      try {
        // Cityテーブルの行数をチェック(1行あれば良い)
        const sql = `select count(city_key) as count FROM ${DbTableName.CITY} where lg_code = @lgCode Limit 1`;
        const row = this.commonDb.prepare<unknown[], {
          count: number;
        }>(sql)
          .get({
            lgCode: packageInfo.lgCode,
          });
        
        // 0行なら、アップデートが必要
        if (!row || row.count === 0) {
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
      const sql = `select count(pref_key) as count from ${DbTableName.PREF} limit 1`;
      const row = this.commonDb.prepare<unknown[], {
        count: number;
      }>(sql)
        .get();
      
      // 0行なら、アップデートが必要
      if (!row || row.count === 0) {
        return {
          needUpdate: true,
          packageInfo,
        };
      }
    } catch (_) {
      // SQLエラー（そもそもテーブルが無いなど）のときは、更新が必要
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
    const packageInfo = packageResponse.body as unknown as CkanPackageResponse;
    const csvMeta: CkanResource | undefined = packageInfo.result!.resources
      .find(x =>
        x.format.toLowerCase().startsWith('csv')
      );

    // CSVがない (予防的なコード)
    if (!csvMeta) {
      return false;
    }
    
    // URLに対するハッシュ文字列の生成
    const urlHash = getUrlHash(csvMeta.url);
    // キャッシュを利用できるか確認する
    const cache = await this.container.urlCacheMgr.readCache({
      key: urlHash,
    });
    if (!cache) {
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

  private getFileShowUrl(packageId: string): string {
    const fileShowUrl = this.container.getFileShowUrl();
    return `${fileShowUrl}?id=${packageId}`;
  }

  _final(callback: (error?: Error | null) => void): void {
    this.receiveFinal = true;
    callback();
  }
}
    
