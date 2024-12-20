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

import { CityDatasetFile } from '@domain/models/city-dataset-file';
import { CityPosDatasetFile } from '@domain/models/city-pos-dataset-file';
import { DatasetParams, IDatasetFileMeta } from '@domain/models/dataset-file';
import { CsvLoadQuery2, DownloadProcessError, DownloadProcessStatus, DownloadResult, isDownloadProcessError } from '@domain/models/download-process-query';
import { ParcelDatasetFile } from '@domain/models/parcel-dataset-file';
import { ParcelPosDatasetFile } from '@domain/models/parcel-pos-dataset-file';
import { PrefDatasetFile } from '@domain/models/pref-dataset-file';
import { PrefPosDatasetFile } from '@domain/models/pref-pos-dataset-file';
import { RsdtdspBlkFile } from '@domain/models/rsdt-blk-file';
import { RsdtdspBlkPosFile } from '@domain/models/rsdt-blk-pos-file';
import { RsdtDspFile } from '@domain/models/rsdt-dsp-file';
import { RsdtDspPosFile } from '@domain/models/rsdt-dsp-pos-file';
import { TownDatasetFile } from '@domain/models/town-dataset-file';
import { TownPosDatasetFile } from '@domain/models/town-pos-dataset-file';
import { parseFilename } from '@domain/services/parse-filename';
import { ThreadJob } from '@domain/services/thread/thread-task';
import { ICsvFile } from '@domain/types/download/icsv-file';
import { AbrgError, AbrgErrorLevel } from '@domain/types/messages/abrg-error';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { Duplex, TransformCallback } from 'node:stream';

export class CsvLoadStep1Transform extends Duplex {
  public timeAmount = 0;

  constructor(private readonly params : {
    lgCodeFilter: Set<string>;
  }) {
    super({
      objectMode: true,
      allowHalfOpen: true,
      read() {},
    });
  }

  _write(
    job: ThreadJob<DownloadResult | DownloadProcessError>,
    _: BufferEncoding,
    callback: TransformCallback,
  ) {
    // エラーになったQueryはスキップする
    if (isDownloadProcessError(job.data)) {
      this.push(job as ThreadJob<DownloadProcessError>);
      callback();
      return;
    }
    const start = Date.now();

    const results = [];
    for (const csvFile of job.data.csvFiles) {

      // ファイル名から情報を読み取る
      const fileMeta = parseFilename({
        filepath: csvFile.name,
      })!;

      // if (!fileMeta) {
      //   return this.push({
      //     taskId: job.taskId,
      //     kind: job.kind,
      //     data: {
      //       message: `Can not parse the filename "${csvFile.name}"`,
      //       status: DownloadProcessStatus.ERROR,
      //       dataset: job.data.dataset,
      //     }
      //   } as ThreadJob<DownloadProcessError>);
      // }
      const datasetFile = this.toDataset({
        fileMeta,
        csvFile,
      });

      results.push({
        csvFile,
        datasetFile,
        fileMeta,
      });
    }
    
    this.push({
      taskId: job.taskId,
      kind: job.kind,
      data: {
        dataset: job.data.dataset,
        files: results,
        status: DownloadProcessStatus.UNSET,
      },
    } as ThreadJob<CsvLoadQuery2>);
    this.timeAmount += Date.now() - start;
    callback();
  }

  private toDataset(params : {
    fileMeta: IDatasetFileMeta;
    csvFile: ICsvFile;
  }) {
    const datasetParams: DatasetParams = {
      fileMeta: params.fileMeta,
      csvFile: params.csvFile,
      lgCodeFilter: this.params.lgCodeFilter,
    };

    switch(params.fileMeta.type) {
      case 'pref': {
        return new PrefDatasetFile(datasetParams);
      }; 
      
      case 'pref_pos': {
        return new PrefPosDatasetFile(datasetParams);
      };

      case 'city': {
        return new CityDatasetFile(datasetParams);
      };
      
      case 'city_pos': {
        return new CityPosDatasetFile(datasetParams);
      };

      case 'town': {
        return new TownDatasetFile(datasetParams);
      };

      case 'town_pos': {
        return new TownPosDatasetFile(params);
      }

      case 'rsdtdsp_blk': {
        return new RsdtdspBlkFile(datasetParams);
      };
      
      case 'rsdtdsp_blk_pos': {
        return new RsdtdspBlkPosFile(datasetParams);
      }

      case 'rsdtdsp_rsdt': {
        return new RsdtDspFile(datasetParams);
      }
      
      case 'rsdtdsp_rsdt_pos': {
        return new RsdtDspPosFile(datasetParams);
      }
    
      case 'parcel': {
        return new ParcelDatasetFile(datasetParams);
      }
      
      case 'parcel_pos': {
        return new ParcelPosDatasetFile(datasetParams);
      }
      
      default:
        throw new AbrgError({
          messageId: AbrgMessage.NOT_IMPLEMENTED,
          level: AbrgErrorLevel.ERROR,
        });
    }
  }
}
