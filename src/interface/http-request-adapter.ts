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
import { StatusCodes } from 'http-status-codes';
import * as https from 'node:https';
import * as http from 'node:http';
import { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';

export type HttpHeader = http.IncomingHttpHeaders & { ':status'?: string | string[] };

export class ResponseHeader {
  private constructor(
    public statusCode: StatusCodes,
    public contentLength: number,
    public eTag?: string,
    public lastModified?: string,
    public conentRange?: string,
  ) {
    Object.freeze(this);
  }

  static from(headers: HttpHeader, statusCode?: number): ResponseHeader {

    const contentLength = parseInt(headers['content-length']?.toString() || '0', 10);
    const status: StatusCodes = statusCode || parseInt(headers[':status']?.toString() || '500', 10);
    const eTag = headers['etag'] as string | undefined;
    const lastModified = headers['last-modified'] as string | undefined;
    const contentRange = headers['content-range'] as string | undefined;

    return new ResponseHeader(
      status,
      contentLength,
      eTag,
      lastModified,
      contentRange,
    );
  }
}

export class ResponseData {
  constructor(
    public readonly header: ResponseHeader,
    public readonly bodyData: unknown,
  ) { }
}
export class BufferResponseData extends ResponseData {
  constructor(
    header: ResponseHeader,
    body: Buffer[],
  ) {
    super(header, Buffer.concat(body));
    Object.freeze(this);
  }
  get body(): Buffer {
    return this.bodyData as Buffer;
  }
}
export class StringResponseData extends ResponseData {
  constructor(
    header: ResponseHeader,
    body: string[],
  ) {
    super(header, body.join(''));
    Object.freeze(this);
  }
  get body(): string {
    return this.bodyData as string;
  }
}

export class JsonResponseData extends ResponseData {
  constructor(
    header: ResponseHeader,
    body: string[],
  ) {
    super(header, JSON.parse(body.join('')));
    Object.freeze(this);
  }
  get body(): Record<string, string | number | object | undefined> {
    return this.bodyData as Record<string, string | number | object | undefined>;
  }
}

export type HttpRequestAdapterOptions = {
  hostname: string;
  userAgent: string;
  peerMaxConcurrentStreams: number;
};

export type GetJsonOptions = {
  url: URL;
  headers?: Record<string, string>;
};

export class HttpRequestAdapter {
  private noLongerReconnect: boolean = false;

  constructor(public readonly options: Required<HttpRequestAdapterOptions>) {
    // シンプルな実装：カスタムエージェントは使用しない
  }


  public getJSON(params: GetJsonOptions): Promise<JsonResponseData> {
    return new Promise<JsonResponseData>((
      resolve: (result: JsonResponseData) => void,
    ) => {
      const process = () => {
        this.request({
          ...params,
          method: 'GET',
          encoding: 'binary',
        })
          .then(response => {
            resolve(new JsonResponseData(
              response.header,
              response.bodyData as string[],
            ));
          })
          .catch(() => {
            setTimeout(() => {
              process();
            }, 3000);
          });
      };
      process();
    });
  }

  public async getText(params: {
    url: URL;
    headers?: Record<string, string>;
  }): Promise<StringResponseData> {
    return new Promise<StringResponseData>((
      resolve: (result: StringResponseData) => void,
    ) => {
      const process = () => {
        this.request({
          ...params,
          method: 'GET',
          encoding: 'binary',
        })
          .then(response => {
            resolve(new StringResponseData(
              response.header,
              response.bodyData as string[],
            ));
          })
          .catch(() => {
            setTimeout(() => {
              process();
            }, 3000);
          });
      };
      process();
    });
  }


  public async getBuffer(params: {
    url: URL;
    headers?: Record<string, string>;
  }): Promise<BufferResponseData> {
    return new Promise<BufferResponseData>((
      resolve: (result: BufferResponseData) => void,
    ) => {
      const process = () => {
        this.request({
          ...params,
          method: 'GET',
          encoding: 'binary',
        })
          .then(response => {
            const data = (response.bodyData as string[]).join('');
            resolve(new BufferResponseData(
              response.header,
              [Buffer.from(data, 'binary')],
            ));
          })
          .catch(() => {
            setTimeout(() => {
              process();
            }, 3000);
          });
      };
      process();
    });
  }


  private async getRequest({
    url,
    headers = {},
  }: {
    url: URL;
    headers?: Record<string, string>;
  }): Promise<StringResponseData> {
    return new Promise<StringResponseData>((
      resolve: (result: StringResponseData) => void,
    ) => {
      const process = () => {
        this.request({
          url,
          method: 'GET',
          headers,
          encoding: 'utf-8',
        })
          .then(response => {
            resolve(new StringResponseData(response.header, response.bodyData as string[]));
          })
          .catch(() => {
            setTimeout(() => {
              process();
            }, 3000);
          });
      };
      process();
    });
  }

  public async headRequest({
    url,
    headers = {},
  }: {
    url: URL;
    headers?: Record<string, string | undefined>;
  }): Promise<ResponseData> {
    return new Promise<ResponseData>((
      resolve: (result: ResponseData) => void,
    ) => {
      const process = () => {
        this.request({
          url,
          method: 'HEAD',
          headers,
          encoding: 'utf-8',
        })
          .then(resolve)
          .catch(() => {
            setTimeout(() => {
              process();
            }, 3000);
          });
      };
      process();
    });
  }

  protected async request({
    url,
    method,
    encoding,
    headers = {},
  }: {
    url: URL;
    method: 'GET' | 'HEAD';
    encoding: BufferEncoding;
    headers?: Record<string, string | undefined>;
  }): Promise<ResponseData> {

    const requestOptions: https.RequestOptions = {
      hostname: url.hostname || this.options.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: {
        ...headers,
        'User-Agent': this.options.userAgent,
      },
      // カスタムエージェントを使用しない（デフォルトのglobalAgentを使用）
    };

    return new Promise((
      resolve: (data: ResponseData) => void,
      reject: (error: Error) => void,
    ) => {
      const req = https.request(requestOptions, (res: IncomingMessage) => {
        const header = ResponseHeader.from(res.headers, res.statusCode);
        const buffer: Buffer[] = [];

        res.setEncoding(encoding);

        res.on('data', (chunk: string | Buffer) => {
          if (typeof chunk === 'string') {
            buffer.push(Buffer.from(chunk, encoding));
          } else {
            buffer.push(chunk);
          }
        });

        res.once('end', () => {
          res.removeAllListeners();
          resolve(new ResponseData(header, buffer));
        });

        res.once('error', (err) => {
          res.removeAllListeners();
          reject(err);
        });
      });

      req.once('error', (err) => {
        req.removeAllListeners();
        reject(err);
      });

      // シンプルなタイムアウト
      req.setTimeout(60000, () => { // 1分
        req.destroy();
      });

      req.end();
    });
  }

  public async getReadableStream({
    url,
    headers = {},
    abortController,
  }: {
    url: URL;
    headers?: Record<string, string | undefined>;
    abortController?: AbortController;
  }): Promise<Readable> {

    const requestOptions: https.RequestOptions = {
      hostname: url.hostname || this.options.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        ...headers,
        'User-Agent': this.options.userAgent,
      },
      // カスタムエージェントを使用しない（デフォルトのglobalAgentを使用）
    };

    return new Promise((
      resolve: (stream: Readable) => void,
      reject: (error: Error) => void,
    ) => {
      const req = https.request(requestOptions, (res: IncomingMessage) => {
        // エラーステータスコードのチェック
        if (res.statusCode && res.statusCode >= 400) {
          res.destroy();
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        if (abortController?.signal.aborted) {
          res.destroy();
          reject(new Error('Request aborted'));
          return;
        }

        res.once('error', (err) => {
          reject(err);
        });

        resolve(res);
      });

      req.once('error', (err) => {
        reject(err);
      });

      // シンプルなタイムアウト
      req.setTimeout(300000, () => { // 5分
        req.destroy();
      });

      if (abortController) {
        abortController.signal.addEventListener('abort', () => {
          req.destroy();
        });
      }

      req.end();
    });
  }

  close() {
    this.noLongerReconnect = true;
    // シンプル実装：特別なクリーンアップは不要
  }
}
