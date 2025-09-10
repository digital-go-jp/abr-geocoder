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
import { SearchTarget } from '@domain/types/search-target';
import { CoordinateData } from '@domain/services/transformations/coordinate-parsing-transform';
import { Duplex } from 'node:stream';
import { AbrGeocoder, QueryCompatibleObject } from './abr-geocoder';

export class AbrReverseGeocoderStream extends Duplex {
  private writeIdx: number = 0;
  private receivedFinal: boolean = false;
  private nextIdx: number = 1;
  private geocoder: AbrGeocoder;
  private searchTarget: SearchTarget;
  private pausing: boolean = false;
  private highWatermark: number;
  private halfWatermark: number;
  private limit: number;

  constructor(params: {
    geocoder: AbrGeocoder,
    searchTarget?: SearchTarget;
    limit?: number;
    highWatermark?: number;
  }) {
    super({
      objectMode: true,
      allowHalfOpen: true,
    });
    this.geocoder = params.geocoder;
    this.searchTarget = params.searchTarget || SearchTarget.ALL;
    this.limit = params.limit || 1;
    this.highWatermark = params.highWatermark || 500;
    this.halfWatermark = this.highWatermark >> 1;

    this.once('close', async () => {
      await params.geocoder.close();
    });
  }

  _read(): void {}

  private closer() {
    if (this.pausing && this.writeIdx - this.nextIdx < this.halfWatermark) {
      this.emit('resume');
      this.pausing = false;
    }

    if (!this.receivedFinal || this.pausing || this.nextIdx <= this.writeIdx) {
      return;
    }
    // 全タスクが処理したので終了
    this.push(null);
  }

  private waiter() {
    // Out of memory を避けるために、受け入れを一時停止
    // 処理済みが追いつくまで、待機する
    const waitingCnt = this.writeIdx - this.nextIdx;
    if (waitingCnt < this.highWatermark || this.pausing) {
      return;
    }

    if (!this.pausing) {
      this.pausing = true;
      this.emit('pause');
    }
  }

  // 前のstreamからデータが渡されてくる
  async _write(
    coordinate: CoordinateData, 
    _: BufferEncoding,
    callback: (error?: Error | null | undefined) => void,
  ) {
    this.waiter();

    const lineId = ++this.writeIdx;

    // 次のタスクをもらうために、callbackを呼び出す
    callback();

    this.geocoder.reverseGeocode({
      lat: coordinate.lat,
      lon: coordinate.lon,
      limit: this.limit,
      searchTarget: this.searchTarget,
    }).then(results => {
      // 各結果をQuery互換オブジェクトに変換してpush
      if (results.length > 0) {
        // limit=1の場合は最初の結果のみ、それ以外は全結果を出力
        const resultsToProcess = this.limit === 1 ? [results[0]] : results;
        
        for (const result of resultsToProcess) {
          const queryCompatible = this.geocoder.convertReverseResultToQueryCompatible(result);
          this.push(queryCompatible);
        }
      } else {
        // 結果がない場合はnullを含むダミーオブジェクトをpush
        const emptyResult: QueryCompatibleObject = {
          unmatched: [],
          others: [],
          tempAddress: null,
          match_level: { str: 'unknown' },
          coordinate_level: { str: 'unknown' },
          formatted: { address: '' },
          rep_lat: coordinate.lat.toString(),
          rep_lon: coordinate.lon.toString(),
          input: { data: { address: '' } },
          release: () => {}
        };
        this.push(emptyResult);
      }
      this.nextIdx++;
      this.closer();
    }).catch(error => {
      // Handle error for reverse geocoding
      console.error('Reverse geocoding error:', error);
      this.nextIdx++;
      this.closer();
    });
  }

  // 前のストリームからの書き込みが終了した
  // (この時点ではタスクキューが空になっている保証はない)
  _final(callback: (error?: Error | null | undefined) => void): void {
    this.receivedFinal = true;
    // 全タスクが終了したかを確認する
    this.closer();
    callback();
  }
}