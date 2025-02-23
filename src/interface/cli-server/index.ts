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
import { AbrgApiServer } from '@interface/abrg-api-server';
import { StatusCodes } from 'http-status-codes';
import { MiddlewareNext, Request, Response, Router, Server } from "hyper-express";
import { OnCommandRequest } from "./on-command-request";

export class CliServer extends Server {

  // アクセスルーター
  private readonly router: Router = new Router();
  
  constructor(private readonly apiServer: AbrgApiServer) {
    super();

    const corsMiddleware = (_: Request, response: Response, next: MiddlewareNext) => {
      response.setHeader('vary', 'Origin');
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      // response.setHeader("Content-Type", "application/json");
      // response.setHeader('Access-Control-Allow-Methods', 'GET');
      // response.setHeader('Access-Control-Allow-Credentials', 'true');
      next();
    };

    // リクエストにCORSヘッダーを付加
    this.use('/', corsMiddleware, this.router);
    
    // command に対するリクエスト
    const onCommandRequest = new OnCommandRequest(this.apiServer, this);
    this.router.post('/command', (request, response) => {
      onCommandRequest.run(request, response)
        .catch((error: string | Error) => {
          this.onInternalServerError(error, response);
        });
    });

    // その他のアクセスは Not found
    this.router.get('*', (_: Request, response: Response) => {
      response.status(StatusCodes.NOT_FOUND);
      response.json({
        status: 'error',
        message: 'Not found',
      });
    });
  }

  private onInternalServerError(error: string | Error, response: Response) {
    response.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
    if (error instanceof Error) {
      response.send(error.message);
    } else {
      response.send(error.toString());
    }
  }
}

