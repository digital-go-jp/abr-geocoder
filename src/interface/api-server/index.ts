
import { DatabaseParams } from "@domain/types/database-params";
import { AbrGeocoder } from "@usecases/geocode/abr-geocoder";
import { AbrGeocoderDiContainer } from "@usecases/geocode/models/abr-geocoder-di-container";
import { StatusCodes } from 'http-status-codes';
import { MiddlewareNext, Request, Response, Router, Server } from "hyper-express";
import { OnGeocodeRequest } from "./on-geocode-request";

export class AbrgApiServer extends Server {

  // アクセスルーター
  private readonly router: Router = new Router();
  
  constructor(container: AbrGeocoderDiContainer) {
    super();

    const corsMiddleware = (_: Request, response: Response, next: MiddlewareNext) => {
      response.setHeader('vary', 'Origin');
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      // response.setHeader("Content-Type", "application/json");
      // response.setHeader('Access-Control-Allow-Methods', 'GET');
      // response.setHeader('Access-Control-Allow-Credentials', 'true');
      next();
    }

    // リクエストにCORSヘッダーを付加
    this.use('/', corsMiddleware, this.router);
    
    // ジオコーダの作成
    const geocoder = new AbrGeocoder({
      container,
      maxConcurrency: 5,
    });

    // geocode に対するリクエスト
    const onGeocodeRequest = new OnGeocodeRequest(geocoder);
    this.router.get('/geocode', (request, response) => {
      onGeocodeRequest.run(request, response)
        .catch(error => this.onInternalServerError(error, response));
    });

    // その他のアクセスは Not found
    this.router.get('*', (_: Request, response: Response) => {
      response.status(StatusCodes.NOT_FOUND);
      response.json({
        status: 'error',
        message: 'Not found'
      });
    });
  }

  private onInternalServerError(error: unknown, response: Response) {
    response.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
    if (error instanceof Error) {
      response.send(error.message);
    } else {
      response.send(error + '');
    }
  }
}

