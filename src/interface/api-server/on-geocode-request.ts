import { OutputFormat } from "@domain/types/output-format";
import { SearchTarget } from "@domain/types/search-target";
import { FormatterProvider } from "@interface/format/formatter-provider";
import { AbrGeocoder } from "@usecases/geocode/abr-geocoder";
import { GeocoderDiContainer, GeocoderDiContainerParams } from "@usecases/geocode/models/geocode-di-container";
import { Query } from "@usecases/geocode/models/query";
import { StatusCodes } from "http-status-codes";
import {
  Request,
  Response
} from "hyper-express";
import stringHash from "string-hash";
import { ApiResponseTransform } from "./api-response-transform";

export class OnGeocodeRequest {

  // ジオコーダーのストリーム
  // 内部でwebworkerによる複数スレッドを立ち上げるので、何度も再作成するのはパフォーマンスが悪くなる。
  // そこで _write と _read の部分だけを利用する
  private readonly geocoder: AbrGeocoder;

  private readonly validFormat;
  private readonly validSearchTargets;

  constructor(params: GeocoderDiContainerParams) {
    const container = new GeocoderDiContainer(params);
    this.geocoder = new AbrGeocoder({
      container,
      maxConcurrency: 5,
    });
    this.geocoder.setMaxListeners(0);

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

    const formatTransform = FormatterProvider.get({
      type: format,
      debug,
    });
    response.type(formatTransform.mimetype);

    const apiResponseTransform = new ApiResponseTransform();
    if (format === 'json' ||
      format == 'geojson' ||
      format === 'ndjson' ||
      format === 'ndgeojson') {
        formatTransform.pipe(apiResponseTransform).pipe(response);
    } else {
      formatTransform.pipe(response);
    }

    const tag = stringHash(Date.now() + ':' + Math.floor(Math.random() * Date.now()));
    const result = await this.geocoder.geocode({
      address,
      tag,
      searchTarget,
      fuzzy,
    });

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