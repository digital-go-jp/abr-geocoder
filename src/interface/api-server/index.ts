
import { DatabaseParams } from "@domain/types/database-params";
import { SearchTarget } from "@domain/types/search-target";
import { StatusCodes } from 'http-status-codes';
import { MiddlewareNext, Request, Response, Router, Server } from "hyper-express";
import { OnGeocodeRequest } from "./on-geocode-request";

export class AbrgApiServer extends Server {

  // アクセスルーター
  private readonly router: Router = new Router();
  
  constructor(params: Required<{
    database: DatabaseParams;
  }>) {
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
    this.use('/', corsMiddleware, this.router);

    const onGeocodeRequest = new OnGeocodeRequest({
      database: params.database,
      debug: false,
    });
    
    this.router.get('/geocode', (request, response) => {
      onGeocodeRequest.run(request, response)
        .catch(error => this.onInternalServerError(error, response));
    });

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

