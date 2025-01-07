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
import { ProgressCallback } from '@config/progress-bar-formats';
import { DownloadProcessError, DownloadRequest, DownloadResult } from '@domain/models/download-process-query';
import { CounterWritable } from '@domain/services/counter-writable';
import { createPackageTree } from '@domain/services/create-package-tree';
import { DatabaseParams } from '@domain/types/database-params';
import { FileGroupKey } from '@domain/types/download/file-group';
import { AbrgError, AbrgErrorLevel } from '@domain/types/messages/abrg-error';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { PrefLgCode, isPrefLgCode } from '@domain/types/pref-lg-code';
import { HttpRequestAdapter } from '@interface/http-request-adapter';
import { CityAndWardTrieFinder } from '@usecases/geocode/models/city-and-ward-trie-finder';
import { CountyAndCityTrieFinder } from '@usecases/geocode/models/county-and-city-trie-finder';
import { KyotoStreetTrieFinder } from '@usecases/geocode/models/kyoto-street-trie-finder';
import { OazaChoTrieFinder } from '@usecases/geocode/models/oaza-cho-trie-finder';
import { PrefTrieFinder } from '@usecases/geocode/models/pref-trie-finder';
import { Tokyo23TownTrieFinder } from '@usecases/geocode/models/tokyo23-town-finder';
import { Tokyo23WardTrieFinder } from '@usecases/geocode/models/tokyo23-ward-trie-finder';
import { WardAndOazaTrieFinder } from '@usecases/geocode/models/ward-and-oaza-trie-finder';
import { WardTrieFinder } from '@usecases/geocode/models/ward-trie-finder';
import { StatusCodes } from 'http-status-codes';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DownloadDiContainer } from './models/download-di-container';
import { CsvParseTransform } from './transformations/csv-parse-transform';
import { DownloadTransform } from './transformations/download-transform';
import { SaveResourceInfoTransform } from './transformations/save-resource-info-transform';

export type DownloaderOptions = {
  // データベース接続に関する情報
  database: DatabaseParams;
  // zipファイルのキャッシュファイルを保存するディレクトリ
  cacheDir: string;
  // zipファイルをダウンロードするディレクトリ
  downloadDir: string;
};

export type DownloadOptions = {
  // ダウンロードするデータの対象を示す都道府県コード
  lgCodes?: string[];
  // 進み具合を示すプログレスのコールバック
  progress?: ProgressCallback;

  //同時ダウンロード数
  concurrentDownloads: number;

  // 使用するスレッド数
  numOfThreads: number;
};

export class Downloader {
  private container: DownloadDiContainer;

  constructor(params: DownloaderOptions) {
    this.container = new DownloadDiContainer({
      cacheDir: params.cacheDir,
      downloadDir: params.downloadDir,
      database: params.database,
    });
  }

  private async getJSON(url: URL) {

    const client = new HttpRequestAdapter({
      hostname: url.hostname,
      // User-Agent
      userAgent: this.container.env.userAgent,
      // 同時並行数(すぐに閉じるので1で良い)
      peerMaxConcurrentStreams: 1,
    });
  
    const response = await client.getJSON({
      url,
    });
    client.close();
    return response;
  }

  async download(params: DownloadOptions) {
    // --------------------------------------
    // ダウンロード開始
    // --------------------------------------
    
    const createDictionaryFileFunctions = [
      PrefTrieFinder.loadDataFile,
      CountyAndCityTrieFinder.loadDataFile,
      CityAndWardTrieFinder.loadDataFile,
      KyotoStreetTrieFinder.loadDataFile,
      OazaChoTrieFinder.loadDataFile,
      WardAndOazaTrieFinder.loadDataFile,
      WardTrieFinder.loadDataFile,
      Tokyo23WardTrieFinder.loadDataFile,
      Tokyo23TownTrieFinder.loadDataFile,
    ];

    // LGCodeを整理する
    const lgCodeFilter = this.aggregateLGcodes(params.lgCodes);
    
    // ダウンロードリクエストを作成する
    const requests = await this.createDownloadRequests(lgCodeFilter);
    const total = requests.length + createDictionaryFileFunctions.length;

    // ランダムに入れ替える（DBの書き込みを分散させるため）
    requests.sort(() => {
      return -1 + Math.random() * 3;
    });

    // ダウンロード処理を行う
    // SQLite書き込み5コアに対して、ダウンロードを1コア、最大で6コアがダウンロードに割り当てる
    const numOfDownloadThreads = Math.min(Math.max(params.numOfThreads / 5, 1), 6);
    const downloadTransform = await DownloadTransform.create({
      container: this.container,

      // スレッド数
      maxConcurrency: numOfDownloadThreads,

      // 1スレッド(1HTTPクライアント)で何ファイル同時並行でダウンロードするか
      maxTasksPerWorker: Math.max(params.concurrentDownloads || 1),
    });

    // ダウンロードしたzipファイルからcsvファイルを取り出してデータベースに登録する
    const numOfCsvParserThreads = Math.max(params.numOfThreads - numOfDownloadThreads, 1);
    const csvParseTransform = await CsvParseTransform.create({
      // CSV Parserのスレッド数
      maxConcurrency: numOfCsvParserThreads,

      // DB書き込みを分散ロックするためのセマフォのサイズ
      // Primary numberであるほうが望ましい
      // 101で適度に分散されるので、固定しておく
      semaphoreSize: 101,

      container: this.container,

      // ダウンロードするターゲットのLGCode
      lgCodeFilter,
    });

    // zipファイルのメタ情報(ETagとか)を記録するDB
    const datasetDb = await this.container.database.openDatasetDb();
    const saveResourceInfoTransform = new SaveResourceInfoTransform({
      datasetDb,
    });

    // 終了したタスク数のカウント
    const dst = new CounterWritable<DownloadResult>({
      write: (_: DownloadResult | DownloadProcessError, __, callback) => {
        params.progress && params.progress(dst.count, total + 1);
        callback();
      },
    });

    const srcStream = Readable.from(requests);

    await pipeline(
      srcStream,
      downloadTransform,
      csvParseTransform,
      saveResourceInfoTransform,
      dst,
    ).catch((e: unknown) => {
      console.error(e);
    });
    await downloadTransform.close();
    await csvParseTransform.close();
  }
  
  private async createDownloadRequests(downloadTargetLgCodes: Set<string>): Promise<DownloadRequest[]> {
    // レジストリ・カタログサーバーから、パッケージの一覧を取得する
    const packageListUrl = this.container.getPackageListUrl();
    const response = await this.getJSON(packageListUrl);

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

    // 各lgCodeが何のdatasetType を持っているのかをツリー構造にする
    // lgcode -> dataset -> packageId
    const lgCodePackages = createPackageTree(packageListResult.result);
    const results: DownloadRequest[] = [];
    const targetPrefixes = new Set<string>();
    const cityPrefixes = new Set<string>();
    downloadTargetLgCodes.forEach(lgCode => {
      const prefix = lgCode.substring(0, 2);
      cityPrefixes.add(prefix);

      const suffix = lgCode.substring(2, 6);
      
      // 都道府県LGCodeの場合、次のステップで、その都道府県下にある市区町村を収集する
      if (suffix === '....') {
        targetPrefixes.add(prefix);
        return;
      }
      // 市区町村LgCodeが指定されている場合、ここでDownloadRequest を作成する
      const packages = lgCodePackages.get(lgCode);
      if (!packages) {
        return false;
      }
      for (const [dataset, packageId] of packages.entries()) {
        results.push({
          kind: 'download',
          dataset,
          packageId,
          useCache: true,
          lgCode,
        } as DownloadRequest);
      }

      return false;
    });

    for (const [lgCode, packages] of lgCodePackages.entries()) {
      const prefix = lgCode.substring(0, 2);
      // 都道府県LgCodeで、市町村が必要な場合、追加する
      if (isPrefLgCode(lgCode)) {
        if (downloadTargetLgCodes.size > 0 && !cityPrefixes.has(prefix)) {
          continue;
        }
        for (const dataset of ['city', 'city_pos'] as FileGroupKey[]) {
          results.push({
            kind: 'download',
            dataset,
            packageId: lgCodePackages.get(lgCode)!.get(dataset)!,
            useCache: true,
            lgCode,
          });
        }
        continue;
      }

      // ダウンロード対象外のlgCodeは省く
      if (downloadTargetLgCodes.size > 0 && !targetPrefixes.has(prefix)) {
        continue;
      }

      // ダウンロードを行う対象に加える
      for (const [dataset, packageId] of packages.entries()) {
        // 市区町村のlgCodeの場合は、ダウンロード対象
        results.push({
          kind: 'download',
          dataset,
          packageId,
          useCache: true,
          lgCode,
        } as DownloadRequest);
      }
    }

    // 都道府県全国マスターだけは必ずダウンロード
    for (const dataset of ['pref', 'pref_pos'] as FileGroupKey[]) {
      results.push({
        kind: 'download',
        dataset,
        packageId: lgCodePackages.get(PrefLgCode.ALL)!.get(dataset)!,
        useCache: true,
        lgCode: '000000',
      });
    }

    // ランダムに並び替えることで、lgCodeが分散され、DB書き込みのときに衝突を起こしにくくなる
    // (衝突すると、書き込み待ちが発生する)
    results.sort(() => Math.random() * 3 - 2);
    return results;
  }

  private aggregateLGcodes(lgCodes: string[] | undefined): Set<string> {
    if (lgCodes === undefined) {
      return new Set();
    }
    // params.lgCodesに含まれるlgCodeが prefLgCode(都道府県を示すlgCode)なら、
    // 市町村レベルのlgCodeは必要ないので省く。

    const results = new Set<string>();
    const others: string[] = [];
    lgCodes.forEach(code => {
      if (code === PrefLgCode.ALL) {
        return;
      }
      if (!isPrefLgCode(code)) {
        others.push(code);
        return;
      }
      const prefix = code.substring(0, 2);
      results.add(`${prefix}....`);
    });

    others.forEach(code => {
      const prefix = code.substring(0, 2);
      if (results.has(`${prefix}....`)) {
        return;
      }
      // 市町村コードをそのまま格納
      results.add(code);
    });

    return results;
  }
}

