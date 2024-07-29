import { OutputFormat } from "@domain/types/output-format";
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

export class OnGeocodeRequest {

  // ジオコーダーのストリーム
  // 内部でwebworkerによる複数スレッドを立ち上げるので、何度も再作成するのはパフォーマンスが悪くなる。
  // そこで _write と _read の部分だけを利用する
  private readonly geocoder: AbrGeocoder;

  constructor(params: GeocoderDiContainerParams) {
    const container = new GeocoderDiContainer(params);
    this.geocoder = new AbrGeocoder({
      container,
      maxConcurrency: 5,
    });
    this.geocoder.setMaxListeners(0);
  }

  async run(request: Request, response: Response) {
    response.setDefaultEncoding('utf-8');

    // TS-node でデバッグしているときのみ、デバッグ情報を出力する
    const debug = process.env.NODE_ENV === 'development';

    // リクエストを行う
    // Note: 1件だけしかジオコードしない、という仕様なので、すぐに null をpushする。
    const address = request.query_parameters['address']?.trim();
    if (!address) {
      response.status(StatusCodes.BAD_REQUEST, 'address is empty');
      response.json({
        status: 'error',
        message: 'The address paramaeter is empty',
      });
      return;
    }

    // writable の引数内では this が Writable を指してしまうので、
    // self で　OnGeocodeRequestクラスへのポインターを維持する
    const self = this;

    // フォーマッターのインスタンスは毎回作成する
    const format = (request.query_parameters['format'] || 'json') as OutputFormat;
    const formatTransform = FormatterProvider.get({
      type: format,
      debug,
    });

    switch (format) {
      case 'ndgeojson':
      case 'geojson':
      case 'ndjson':
      case 'json': {
        response.type('application/json');
        break;
      }

      case 'simplified':
      case 'csv': {
        response.type('text/csv');
        break;
      }

      default: {
        response.status(StatusCodes.BAD_REQUEST, 'format is invalid');
        response.send('format is invalid');
        break;
      }
    }
    
    formatTransform.pipe(response);

    const tag = stringHash(Date.now() + ':' + Math.floor(Math.random() * Date.now()));
    const result = await self.geocoder.geocode({
      address,
      tag,
    });

    const query = Query.from(result);
    formatTransform.write(query);
    formatTransform.end();
  }
}