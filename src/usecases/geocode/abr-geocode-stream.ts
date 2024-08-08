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
import { DEFAULT_FUZZY_CHAR } from '@config/constant-values';
import { CommentFilterTransform } from '@domain/transformations/comment-filter-transform';
import { DatabaseParams } from '@domain/types/database-params';
import { SearchTarget } from '@domain/types/search-target';
import { Duplex, Readable, Writable } from 'node:stream';
import { AbrGeocoder } from './abr-geocoder';
import { AbrGeocoderDiContainer } from './models/abr-geocoder-di-container';
import { Query } from './models/query';
import { ThreadGeocodeTransform } from './transformations/thread-geocoder-transform';

export type AbrGeocodeOptions = {
  fuzzy: string;
  searchTarget: SearchTarget;
  database: DatabaseParams;
  debug?: boolean;
  cacheDir: string;
  progress?: (current: number, total: number) => void;
};

export class AbrGeocodeStream extends Duplex {

  private reader = new Readable({
    read() {},
  });
  private textReaderTransform: CommentFilterTransform;
  private geocoderTransform: ThreadGeocodeTransform;
  private dstStream: Writable;
  private outCnt = 0;

  private constructor(
    geocoder: AbrGeocoder,
    container: AbrGeocoderDiContainer,
    params: AbrGeocodeOptions,
  ) {
    super({
      objectMode: true,
      allowHalfOpen: true,
      read() {},
    });

    this.dstStream = new Writable({
      objectMode: true,
      write: (chunk: Query, _, callback: (error?: Error | null) => void) => {
        callback();
        this.outCnt++;
        this.push(chunk);
        // if (this.receivedFinal && this.textReaderTransform.total === this.outCnt) {
        //   // this.geocoderTransform.end();
        //   this.push(null);
        // }
      },

      final: (callback) => {
        this.push(null);
        callback();
      },
    });

    // コメントを取り除く
    this.textReaderTransform = new CommentFilterTransform();

    // ジオコーディング処理
    this.geocoderTransform = new ThreadGeocodeTransform({
      container,
      geocoder,
      fuzzy: params.fuzzy || DEFAULT_FUZZY_CHAR,
      searchTarget: params.searchTarget,
    });
    if (params.progress) {
      this.geocoderTransform.on('progress', (current: number, total: number) => {
        params.progress!(current, total);
      });
    }

    this.reader
      .pipe(this.textReaderTransform)
      .pipe(this.geocoderTransform)
      .pipe(this.dstStream);
  } 

  _write(chunk: Buffer, _: BufferEncoding, callback: (error?: Error | null) => void): void {
    // メイン処理
    this.reader.push(chunk);
    callback();
  }

  _final(callback: (error?: Error | null) => void): void {
    this.reader.push(null);
    callback();
  }

  static readonly create = async (params: Required<AbrGeocodeOptions>) => {

    // DIコンテナをセットアップする
    // 初期設定値を DIコンテナに全て詰め込む
    const container = new AbrGeocoderDiContainer({
      database: params.database,
      debug: params.debug === true,
      cacheDir: params.cacheDir,
    });

    const numOfThreads = Math.max(container.env.availableParallelism() - 1, 1);

    const geocoder = await AbrGeocoder.create({
      container,
      numOfThreads,
    })

    return new AbrGeocodeStream(geocoder, container, params);
  }
};