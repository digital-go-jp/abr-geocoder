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
import { OutputFormat } from "@domain/types/output-format";
import { SearchTarget } from "@domain/types/search-target";
import { FormatterProvider } from "@interface/format/formatter-provider";
import { AbrGeocoder } from "@usecases/geocode/abr-geocoder";
import { Query } from "@usecases/geocode/models/query";
import { StatusCodes } from "http-status-codes";
import { Request, Response } from "hyper-express";

export class OnGeocodeRequest {

  private readonly validFormat;
  private readonly validSearchTargets;

  constructor(
    private readonly geocoder: AbrGeocoder,
  ) {

    // 有効なフォーマット
    const formats = Array.from(Object.values(OutputFormat));
    this.validFormat= new Set<string>(formats);

    // 有効な検索対象
    const searchTargets = Array.from(Object.values(SearchTarget));
    this.validSearchTargets = new Set<string>(searchTargets);
  }

  async run(request: Request, response: Response) {
    response.setDefaultEncoding('utf-8');

    // TS-node でデバッグしているときのみ、デバッグ情報を出力する
    const debug = process.env.NODE_ENV === 'development';

    // リクエストを行う
    const address = request.query_parameters['address']?.trim();
    if (!address) {
      response.status(StatusCodes.BAD_REQUEST, 'address is empty');
      response.json({
        status: 'error',
        message: 'The address paramaeter is empty',
      });
      return;
    }

    // 検索対象
    const searchTarget = request.query_parameters['target']?.trim() || SearchTarget.ALL;
    if (!this.validateTargetOption(searchTarget)) {
      response.status(StatusCodes.BAD_REQUEST, 'target is invalid');
      response.json({
        status: 'error',
        message: 'The target paramaeter is invalid',
      });
      return;
    }

    // ワイルドカード
    const fuzzy = request.query_parameters['fuzzy']?.trim();
    if (fuzzy && !this.validateFuzzyOption(fuzzy)) {
      response.status(StatusCodes.BAD_REQUEST, 'fuzzy is invalid');
      response.json({
        status: 'error',
        message: 'The fuzzy paramaeter is invalid',
      });
      return;
    }

    // フォーマッターのインスタンスは毎回作成する
    const format = ((request.query_parameters['format'] || 'json')).toLocaleLowerCase();
    if (!this.validateFormatOption(format)) {
      response.status(StatusCodes.BAD_REQUEST, 'format is invalid');
      response.send('format is invalid');
      return;
    }

    // フォーマッターの出力結果を response に書き込む
    const formatTransform = FormatterProvider.get({
      type: format,
      debug,
    });
    response.type(formatTransform.mimetype);
    formatTransform.pipe(response);

    // 1件単位でジオコーディングを行う
    // ストリームで処理するほうが効率は良いが
    // サーバーで使用する場合、他のリクエストと重なる可能性があるので
    // 1件単位で処理する
    const result = await this.geocoder.geocode({
      address,
      tag: undefined,
      searchTarget,
      fuzzy,
    });

    // 
    const query = Query.from(result);
    formatTransform.write(query);
    formatTransform.end();
  }

  private validateFuzzyOption(value: string): boolean {
    return value.length === 1;
  }

  private validateTargetOption(value: string): value is SearchTarget {
    return this.validSearchTargets.has(value);
  }

  private validateFormatOption(value: string): value is OutputFormat {
    return this.validFormat.has(value);
  }
}
