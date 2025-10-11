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
  private nextIdx: number = 0;
  private outputIdx: number = 0;
  private geocoder: AbrGeocoder;
  private searchTarget: SearchTarget;
  private resultBuffer: Map<number, any[]> = new Map();
  private processedIds: Set<number> = new Set();
  private pausing: boolean = false;
  private highWatermark: number;
  private halfWatermark: number;
  private limit: number;
  private useSpatialIndex: boolean;

  constructor(params: {
    geocoder: AbrGeocoder,
    searchTarget?: SearchTarget;
    limit?: number;
    useSpatialIndex?: boolean;
    highWatermark?: number;
  }) {
    super({
      objectMode: true,
      allowHalfOpen: true,
    });
    this.geocoder = params.geocoder;
    this.searchTarget = params.searchTarget || SearchTarget.ALL;
    this.limit = params.limit || 1;
    this.useSpatialIndex = params.useSpatialIndex ?? true;
    this.highWatermark = params.highWatermark || 500;
    this.halfWatermark = this.highWatermark >> 1;

    this.once('close', async () => {
      await params.geocoder.close();
    });
  }

  _read(): void {}

  private closer() {
    // バッファから順序通りに結果を出力
    this.flushOrderedResults();

    // nextIdxを出力済みのところまで進める
    this.nextIdx = this.outputIdx;

    if (this.pausing && this.writeIdx - this.nextIdx < this.halfWatermark) {
      this.emit('resume');
      this.pausing = false;
    }

    if (!this.receivedFinal || this.pausing) {
      return;
    }

    // すべての処理が完了したかチェック
    const allProcessed = this.processedIds.size === this.writeIdx;
    const allOutput = this.outputIdx === this.writeIdx;
    
    if (!allProcessed) {
      // まだ処理中のものがある
      return;
    }
    
    // 処理は完了したがバッファに残っているものがある場合は強制フラッシュ
    if (this.resultBuffer.size > 0) {
      console.error(`Warning: Force flushing ${this.resultBuffer.size} remaining results`);
      const sortedKeys = Array.from(this.resultBuffer.keys()).sort((a, b) => a - b);
      for (const key of sortedKeys) {
        const results = this.resultBuffer.get(key);
        if (results) {
          for (const result of results) {
            this.push(result);
          }
        }
      }
      this.resultBuffer.clear();
      this.outputIdx = this.writeIdx; // 強制的に同期
    }
    
    // すべて出力済みの場合のみ終了
    if (this.outputIdx === this.writeIdx) {
      // 全タスクが処理したので終了
      this.push(null);
    }
  }

  private flushOrderedResults() {
    // outputIdx + 1 から順番に、連続して存在する結果をすべて出力
    while (this.resultBuffer.has(this.outputIdx + 1)) {
      const results = this.resultBuffer.get(this.outputIdx + 1);
      this.resultBuffer.delete(this.outputIdx + 1);

      // デバッグ: 処理中のインデックスを記録
      // console.error(`Flushing result for index ${this.outputIdx + 1}`);

      if (results) {
        for (const result of results) {
          this.push(result);
        }
      }

      this.outputIdx++;
      // nextIdxは増やさない - これは処理待ちのタスクを追跡するもの
    }

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
      useSpatialIndex: this.useSpatialIndex,
    }).then(results => {
      const resultsToStore: any[] = [];
      
      // 各結果をQuery互換オブジェクトに変換
      if (results.length > 0) {
        // limit=1の場合は最初の結果のみ、それ以外は全結果を出力
        const resultsToProcess = this.limit === 1 ? [results[0]] : results;
        
        for (const result of resultsToProcess) {
          const queryCompatible = this.geocoder.convertReverseResultToQueryCompatible(result);
          resultsToStore.push(queryCompatible);
        }
      } else {
        // 結果がない場合はnullを含むダミーオブジェクトを保存
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
        resultsToStore.push(emptyResult);
      }
      
      // バッファに保存
      this.resultBuffer.set(lineId, resultsToStore);
      this.processedIds.add(lineId);
      this.closer();
    }).catch(error => {
      // Handle error for reverse geocoding
      console.error('Reverse geocoding error:', error);

      // エラーの場合も空の結果をバッファに保存
      const errorResult: QueryCompatibleObject = {
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
      this.resultBuffer.set(lineId, [errorResult]);
      this.processedIds.add(lineId);
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
