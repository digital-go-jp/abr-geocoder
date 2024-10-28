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
import { SearchTarget } from '@domain/types/search-target';
import { Duplex } from 'node:stream';
import timers from 'node:timers/promises';
import { AbrGeocoder } from '../abr-geocoder';
import { AbrGeocoderDiContainer } from '../models/abr-geocoder-di-container';
import { AbrGeocoderInput } from '../models/abrg-input-data';
import { Query } from '../models/query';
// import inspector from "node:inspector";

export class ThreadGeocodeTransform extends Duplex {
  private writeIdx: number = 0;
  private receivedFinal: boolean = false;
  private nextIdx: number = 1;
  private geocoder: AbrGeocoder;
  private searchTarget: SearchTarget;
  private fuzzy: string | undefined;

  constructor(params: Required<{
    container: AbrGeocoderDiContainer,
    geocoder: AbrGeocoder,
    fuzzy: string;
    searchTarget?: SearchTarget;
  }>) {
    super({
      objectMode: true,
      allowHalfOpen: true,
    });
    this.geocoder = params.geocoder;
    this.fuzzy = params.fuzzy || DEFAULT_FUZZY_CHAR;
    this.searchTarget = params.searchTarget || SearchTarget.ALL;

    this.once('close', async () => {
      await params.geocoder.close();
    });
  }

  _read(): void {}

  private closer() {
    if (!this.receivedFinal || this.isPaused() || this.nextIdx <= this.writeIdx) {
      return;
    }
    // 全タスクが処理したので終了
    this.push(null);
  }

  private async waiter() {
    // Out of memory を避けるために、受け入れを一時停止
    // 処理済みが追いつくまで、待機する
    const waitingCnt = this.writeIdx - this.nextIdx;
    if (waitingCnt < 100) {
      return;
    }

    while (this.writeIdx - this.nextIdx > 50) {
      await timers.setTimeout(10);
    }
  }

  // 前のstreamからデータが渡されてくる
  async _write(
    input: string | AbrGeocoderInput, 
    _: BufferEncoding,
    callback: (error?: Error | null | undefined) => void,
  ) {
    await this.waiter();

    const lineId = ++this.writeIdx;

    if (typeof input === 'string') {
      input = {
        address: input,
        searchTarget: this.searchTarget,
        fuzzy: this.fuzzy,
        tag: {
          lineId,
        },
      };
    }

    // 次のタスクをもらうために、callbackを呼び出す
    callback();

    this.geocoder.geocode(input)
      // 処理が成功したら、別スレッドで処理した結果をQueryに変換する
      .then((result: Query) => {
        this.push(result);
        this.emit('progress', this.nextIdx, this.writeIdx);
        this.nextIdx++;
        this.closer();
        // this.emit(this.kShiftEvent, result);
      });
    // エラーが発生した
    // .catch((error: Error | string) => {
    //   const query = Query.create(input);
    //   this.emit(this.kShiftEvent, query.copy({
    //     match_level: MatchLevel.ERROR,
    //   }));
    // })

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


