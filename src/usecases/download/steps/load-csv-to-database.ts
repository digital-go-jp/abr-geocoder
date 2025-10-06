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
import { AbrgError, AbrgErrorLevel } from "@domain/types/messages/abrg-error";
import { AbrgMessage } from "@domain/types/messages/abrg-message";
import { DownloadDbController } from "@drivers/database/download-db-controller";
import { StreamLimiter } from "@domain/services/transformations/stream-limitter";
import csvParser from "csv-parser";
import fs from 'node:fs';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const loadCsvToDatabase = async (params : Required<{
  datasetFile: DatasetFile;
  databaseCtrl: DownloadDbController;
  lgCodeFilter: Set<string>;
}>): Promise<void> => {
  const srcStream = fs.createReadStream(params.datasetFile.csvFile.path, {
    encoding: 'utf-8',
  });

  await pipeline(
    srcStream,

    csvParser({
      skipComments: true,
    }),

    // OutOfMemoryを避けつつ、パフォーマンスを確保するため、10000件ごとデータベースに登録していく
    // (10000件毎 and 最後に flushが実行される)
    new StreamLimiter(10000),

    new Writable({
      objectMode: true,
      async write(csvLines: CsvLine[], _, next) {
        if (!srcStream.isPaused()) {
          srcStream.pause();
        }

        // 都道府県レベルのrsdt_blk/rsdt_dspの場合、市町村別に振り分ける
        const isPrefLevelRsdt =
          (params.datasetFile.type === 'rsdtdsp_blk' ||
           params.datasetFile.type === 'rsdtdsp_blk_pos' ||
           params.datasetFile.type === 'rsdtdsp_rsdt' ||
           params.datasetFile.type === 'rsdtdsp_rsdt_pos') &&
          params.datasetFile.lgCode.endsWith('....');

        if (isPrefLevelRsdt) {
          // 市町村別にグループ化
          const linesByLgCode = new Map<string, CsvLine[]>();
          for (const line of csvLines) {
            const lgCode = line.lg_code?.toString();
            if (!lgCode) {
              continue;
            }
            // lgCodeFilterが指定されている場合はフィルタリング
            if (params.lgCodeFilter.size > 0 && !params.lgCodeFilter.has(lgCode)) {
              continue;
            }
            if (!linesByLgCode.has(lgCode)) {
              linesByLgCode.set(lgCode, []);
            }
            linesByLgCode.get(lgCode)!.push(line);
          }

          // 各市町村ごとにDBを開いて処理
          for (const [lgCode, lines] of linesByLgCode) {
            const db = await openDb({
              dbCtrl: params.databaseCtrl,
              datasetFile: params.datasetFile,
              overrideLgCode: lgCode,
            });

            if (db) {
              try {
                await params.datasetFile.process({
                  lines,
                  db,
                });
              } catch (e) {
                console.error('[ERROR] process() failed for prefecture-level rsdt:', {
                  type: params.datasetFile.type,
                  lgCode: lgCode,
                  error: e,
                  message: e instanceof Error ? e.message : JSON.stringify(e),
                });
              } finally {
                await db.close();
              }
            }
          }
        } else {
          // 従来の処理（市町村レベルまたはcommonDBの場合）
          const db = await openDb({
            dbCtrl: params.databaseCtrl,
            datasetFile: params.datasetFile,
          });

          if (db) {
            try {
              // データをテーブルに読み込む
              await params.datasetFile.process({
                lines: csvLines,
                db,
              });
            } catch (e) {
              console.error('[ERROR] process() failed:', {
                type: params.datasetFile.type,
                lgCode: params.datasetFile.lgCode,
                error: e,
                message: e instanceof Error ? e.message : JSON.stringify(e),
              });
            } finally {
              await db.close();
            }
          }
        }

        if (srcStream.isPaused()) {
          srcStream.resume();
        }

        next();
      },
    }),
  );
};

const openDb = (params: {
  dbCtrl: DownloadDbController,
  datasetFile: DatasetFile,
  overrideLgCode?: string,
}) => {
  const lgCode = params.overrideLgCode ?? params.datasetFile.lgCode;

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
        lg_code: lgCode,
        createIfNotExists: true,
      });

    case 'rsdtdsp_rsdt':
    case 'rsdtdsp_rsdt_pos':
      return params.dbCtrl.openRsdtDspDb({
        lg_code: lgCode,
        createIfNotExists: true,
      });

    case 'parcel':
    case 'parcel_pos':
      return params.dbCtrl.openParcelDb({
        lg_code: lgCode,
        createIfNotExists: true,
      });

    default:
      throw new AbrgError({
        messageId: AbrgMessage.NOT_IMPLEMENTED,
        level: AbrgErrorLevel.ERROR,
      });
  }
};
