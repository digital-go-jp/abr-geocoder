/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
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
import { DatabaseParams } from '@domain/types/database-params';
import { SearchTarget } from '@domain/types/search-target';
import { Duplex, Writable } from 'node:stream';
import { AbrGeocoderDiContainer } from './models/abr-geocoder-di-container';
import { Query } from './models/query';
import { TextReaderTransform } from './transformations/text-reader-transform';
import { ThreadGeocodeTransform } from './transformations/thread-geocoder-transform';
import { AbrGeocoder } from './abr-geocoder';
import { DEFAULT_FUZZY_CHAR } from '@config/constant-values';

export type AbrGeocodeOptions = {
  dataDir?: string;
  fuzzy?: string;
  searchTarget: SearchTarget;
  database: DatabaseParams;
  debug?: boolean;
  progress?: (current: number, total: number, isPaused: boolean) => void;
};

export class AbrGeocodeStream extends Duplex {

  private textReaderTransform: TextReaderTransform;
  private geocoderTransform: ThreadGeocodeTransform;
  private dstStream: Writable;
  private outCnt = 0;
  private receivedFinal: boolean = false;

  constructor(params: AbrGeocodeOptions) {
    super({
      objectMode: true,
      allowHalfOpen: true,
      read() {},
    });

    const self = this;
    this.dstStream = new Writable({
      objectMode: true,
      write(chunk: Query, _, callback: (error?: Error | null) => void): void {
        callback();
        self.outCnt++;
        self.push(chunk);
        if (self.receivedFinal && self.textReaderTransform.total === self.outCnt) {
          self.geocoderTransform.end();
          self.push(null);
        }
      },
    });

    // DIコンテナをセットアップする
    // 初期設定値を DIコンテナに全て詰め込む
    const container = new AbrGeocoderDiContainer({
      database: params.database,
      debug: params.debug === true,
    });

    // ジオコーダ
    const maxConcurrency = Math.floor(container.env.availableParallelism() * 1.3);
    const geocoder = new AbrGeocoder({
      container,
      maxConcurrency,
    });

    // コメントを取り除く
    this.textReaderTransform = new TextReaderTransform();

    // ジオコーディング処理
    this.geocoderTransform = new ThreadGeocodeTransform({
      container,
      geocoder,
      fuzzy: params.fuzzy || DEFAULT_FUZZY_CHAR,
      searchTarget: params.searchTarget,
    });
    if (params.progress) {
      this.geocoderTransform.on('progress', (current: number, total: number, isPaused: boolean) => {
        params.progress!(current, total, isPaused);
      });
    }

    this.textReaderTransform
      .pipe(this.geocoderTransform)
      .pipe(this.dstStream);
  } 

  _write(chunk: Buffer, _: BufferEncoding, callback: (error?: Error | null) => void): void {
    callback();
    // メイン処理
    this.textReaderTransform.write(chunk);
  }

  _final(callback: (error?: Error | null) => void): void {
    this.receivedFinal = true;
    callback();
  }
};