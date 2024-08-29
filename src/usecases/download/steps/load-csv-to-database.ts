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
import { CsvLine, DatasetFile } from "@domain/models/dataset-file";
import { SemaphoreManager } from "@domain/services/thread/semaphore-manager";
import { AbrgError, AbrgErrorLevel } from "@domain/types/messages/abrg-error";
import { AbrgMessage } from "@domain/types/messages/abrg-message";
import { DownloadDbController } from "@interface/database/download-db-controller";
import { ConsolidateTransform } from "@usecases/geocode/transformations/consolidate-trnasform";
import csvParser from "csv-parser";
import fs from 'node:fs';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const getSemaphoreIdx = (datasetFile: DatasetFile, size: number): number => {
  if (datasetFile.type === 'pref' ||
    datasetFile.type === 'pref_pos' ||
    datasetFile.type === 'city' ||
    datasetFile.type === 'city_pos' ||
    datasetFile.type === 'town' ||
    datasetFile.type === 'town_pos') {
    return 0;
  }

  return (parseInt(datasetFile.lgCode) % (size / 4 - 1)) + 1;
};

export const loadCsvToDatabase = async (params : Required<{
  semaphore: SemaphoreManager;
  datasetFile: DatasetFile;
  databaseCtrl: DownloadDbController;
}>): Promise<void> => {
  // console.log(`     > ${params.datasetFile.filename}`);

  const semaphoreIdx = getSemaphoreIdx(params.datasetFile, params.semaphore.size);

  const db = await openDb({
    dbCtrl: params.databaseCtrl,
    datasetFile: params.datasetFile,
  });
  if (!db) {
    return;
  }

  await pipeline(
    fs.createReadStream(params.datasetFile.csvFile.path, {
      encoding: 'utf-8',
    }),

    csvParser({
      skipComments: true,
    }),

    // OutOfMemoryを避けつつ、パフォーマンスを確保するため、10000件ごとデータベースに登録していく
    // (10000件毎 and 最後に flushが実行される)
    new ConsolidateTransform(10000),

    new Writable({
      objectMode: true,
      async write(csvLines: CsvLine[], _, next) {
        if (!db) {
          return next();
        }

        // セマフォで同時書き込みの排除
        await params.semaphore.enterAwait(semaphoreIdx);

        // データを一時テーブルに読み込む
        await params.datasetFile.process({
          lines: csvLines,
          db,
        }).catch((e) => {
          console.error(`error: ${e}`);
        });

        // 書き込みロックを解除
        params.semaphore.leave(semaphoreIdx);
        
        next();
      },
    }),
  );

  await db.closeDb();
};

const openDb = (params: {
  dbCtrl: DownloadDbController,
  datasetFile: DatasetFile,
}) => {
  switch (params.datasetFile.type) {
    case 'pref':
    case 'pref_pos':
    case 'city':
    case 'city_pos':
    case 'town':
    case 'town_pos':
      return params.dbCtrl.openCommonDb();
    
    case 'rsdtdsp_blk_pos':
    case 'rsdtdsp_blk':
      return params.dbCtrl.openRsdtBlkDb({
        lg_code: params.datasetFile.lgCode,
        createIfNotExists: true,
      });
    
    case 'rsdtdsp_rsdt':
    case 'rsdtdsp_rsdt_pos':
      return params.dbCtrl.openRsdtDspDb({
        lg_code: params.datasetFile.lgCode,
        createIfNotExists: true,
      });
    
    case 'parcel':
    case 'parcel_pos':
      return params.dbCtrl.openParcelDb({
        lg_code: params.datasetFile.lgCode,
        createIfNotExists: true,
      });
    
    default:
      throw new AbrgError({
        messageId: AbrgMessage.NOT_IMPLEMENTED,
        level: AbrgErrorLevel.ERROR,
      });
  }
};
