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
import { DownloadRequest } from '@domain/models/download-process-query';
import { EnvProvider } from '@domain/models/env-provider';
import * as geocodeDbControllerModule from '@drivers/database/geocode-db-controller';
import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import * as CsvParserTransformMockModule from '@usecases/download/transformations/__mocks__/csv-parse-transform';
import * as DownloadTransformMockModule from '@usecases/download/transformations/__mocks__/download-transform';
import { Downloader } from '../download-process';

// @@drivers/database/__mocks__/geocode-db-controller
jest.mock('@drivers/database/geocode-db-controller');

// @usecases/download/transformations/__mocks__/download-transform
jest.mock('@usecases/download/transformations/download-transform');

// @usecases/download/transformations/__mocks__/csv-parse-transform
jest.mock('@usecases/download/transformations/csv-parse-transform');

// @usecases/download/models/__mocks__/download-di-container
jest.mock('@usecases/download/models/download-di-container');

// @interface/__mocks__/http-request-adapter
jest.mock('@interface/http-request-adapter');

// @usecases/download/transformations/__mocks__/save-resource-info-transform
jest.mock('@usecases/download/transformations/save-resource-info-transform');

const _mockedModules = {
  geocodeDbController: jest.requireMock<typeof geocodeDbControllerModule>('@drivers/database/geocode-db-controller'),
  downloadDiContainer: jest.requireMock('@usecases/download/models/download-di-container'),
  downloadTransform: jest.requireMock<typeof DownloadTransformMockModule>('@usecases/download/transformations/download-transform'),
  csvParserTransform: jest.requireMock<typeof CsvParserTransformMockModule>('@usecases/download/transformations/csv-parse-transform'),
  httpRequestAdapter: jest.requireMock('@interface/http-request-adapter'),
};

const MOCK_ENV_CPU_CORES = 10;
jest.spyOn(EnvProvider.prototype, 'availableParallelism').mockReturnValue(MOCK_ENV_CPU_CORES);

const testSettings = {
  concurrentDownloads: 7,
  numOfThreads: 1,
};

describe('Downloader', () => {
  const progressSpy = jest.fn();
  let aggregaterSpy: jest.SpiedFunction<(params: string[] | undefined) => Set<string>>;
  let createDownloadRequestsSpy: jest.SpiedFunction<(downloadTargetLgCodes: Set<string>) => Promise<DownloadRequest[]>>;

  beforeAll(async () => {
    const instance = new Downloader({
      database: {
        type: 'sqlite3',
        dataDir: 'dataDir_somewhere',
      },
      cacheDir: 'cacheDir_somewhere',
      downloadDir: 'downloadDir_somewhere',
    });

    expect(instance).not.toBeNull();

    // privateメソッドなので、instance as any にしてアクセスする
    aggregaterSpy = jest.spyOn(instance as any, 'aggregateLGcodes');

    // privateメソッドなので、instance as any にしてアクセスする
    createDownloadRequestsSpy = jest.spyOn(instance as any, 'createDownloadRequests');

    await instance.download({
      lgCodes: [
        '131016', // 東京都千代田区
        '262013', // 京都府福知山市
        '260002', // 京都府
      ],
      progress: progressSpy,
      concurrentDownloads: testSettings.concurrentDownloads,
      numOfThreads: testSettings.numOfThreads,
    });
  });

  test('aggregateLGcodes() should aggregate LG codes ', () => {

    // 京都府福知山市(262013) と 京都府(260002) のLGCodeを指定している
    // 京都府(260002) が 京都府福知山市(262013) をカバーするので、
    // this.aggregateLGcodes() で 京都府全体を示す "26...." にする
    const results = aggregaterSpy.mock.results.pop();
    expect(results?.value).toBeDefined();
    expect(Array.from(results!.value as Set<string>)).toEqual(
      expect.arrayContaining(['26....', '131016']),
    );
  });

  test('createDownloadRequests() should create requests for specified LG codes', async () => {
    // src/interface/__mocks__/http-request-adapter.ts に定義してあるパッケージリストの中から
    // 131016 と 京都府全て('26....')の市町村のパッケージに対するリクエストを作成する

    const results = createDownloadRequestsSpy.mock.results.pop();
    const values = (await Promise.resolve(results?.value)) as DownloadRequest[];

    // 新しい実装ではpackageIdがURL形式になっているため、
    // lgCodeとdatasetの組み合わせが正しいかをチェック
    expect(values.length).toBeGreaterThan(0);

    // packageIdがURL形式であることを確認
    values.forEach(req => {
      expect(req.packageId).toMatch(/^https:\/\/.*\.csv\.zip$/);
    });

    // 特定のlgCodeとdatasetの組み合わせが存在することを確認
    const lgCodeDatasetPairs = values.map(v => `${v.lgCode}:${v.dataset}`);
    expect(lgCodeDatasetPairs).toContain('131016:town');
    expect(lgCodeDatasetPairs).toContain('131016:parcel');
    expect(lgCodeDatasetPairs).toContain('262013:town');
    expect(lgCodeDatasetPairs).toContain('000000:pref');
  });


  test('progress() should be called', () => {
    // ダウンロードリクエストの回数分だけコールバックが呼ばれるはず
    // progressSpyが実際に呼ばれていることを確認
    expect(progressSpy.mock.calls.length).toBeGreaterThan(0);
  });


});
