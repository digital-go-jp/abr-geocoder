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
import https from 'node:https';
import http from 'node:http';
import { Readable } from 'node:stream';

export type HttpHeader = http.IncomingHttpHeaders;

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

  static from(headers: HttpHeader, statusCode: number): ResponseHeader {
    const contentLength = parseInt(headers['content-length'] || '0', 10);
    const eTag = headers['etag'] as string | undefined;
    const lastModified = headers['last-modified'] as string | undefined;
    const contentRange = headers['content-range'] as string | undefined;

    return new ResponseHeader(
      statusCode,
      contentLength,
      eTag,
      lastModified,
      contentRange,
    );
  }
}

export class ResponseData {
  public header: ResponseHeader;
  public bodyData: Buffer[] | string[];

  constructor(header: ResponseHeader, bodyData: Buffer[] | string[]) {
    this.header = header;
    this.bodyData = bodyData;
    Object.freeze(this);
  }
}

export class JsonResponseData extends ResponseData {
  constructor(
    header: ResponseHeader,
    body: string[],
  ) {
    super(header, [JSON.parse(body.join(''))]);
  }

  get body(): unknown {
    return this.bodyData[0];
  }
}

type GetJsonOptions = {
  url: URL;
  headers?: Record<string, string>;
};

export type HttpRequestAdapterOptions = {
  hostname: string;
  userAgent: string;
  peerMaxConcurrentStreams?: number;
};

export class HttpRequestAdapter {
  private readonly agent: https.Agent;

  constructor(public readonly options: Required<HttpRequestAdapterOptions>) {
    this.agent = new https.Agent({
      keepAlive: true,
      maxSockets: options.peerMaxConcurrentStreams,
    });
  }

  public getJSON(params: GetJsonOptions): Promise<JsonResponseData> {
    return new Promise<JsonResponseData>((
      resolve: (result: JsonResponseData) => void,
    ) => {
      const process = () => {
        this.request({
          ...params,
          method: 'GET',
          encoding: 'utf-8',
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

  public async headRequest(params: {
    url: URL;
    headers?: Record<string, string | undefined>;
  }): Promise<ResponseData> {
    return new Promise<ResponseData>((
      resolve: (result: ResponseData) => void,
    ) => {
      const process = () => {
        this.request({
          url: params.url,
          method: 'HEAD',
          headers: params.headers,
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

  protected async request(params: {
    url: URL;
    method: 'GET' | 'HEAD';
    encoding: BufferEncoding;
    headers?: Record<string, string | undefined>;
  }): Promise<ResponseData> {
    return new Promise<ResponseData>((
      resolve: (data: ResponseData) => void,
      reject: (error: Error) => void,
    ) => {
      const requestOptions: https.RequestOptions = {
        hostname: params.url.hostname,
        port: params.url.port || 443,
        path: params.url.pathname + params.url.search,
        method: params.method,
        headers: {
          ...params.headers,
          'User-Agent': this.options.userAgent,
        },
        agent: this.agent,
      };

      const req = https.request(requestOptions, (res) => {
        const buffer: Buffer[] = [];

        res.setEncoding(params.encoding);

        res.on('data', (chunk: Buffer) => {
          buffer.push(chunk);
        });

        res.on('end', () => {
          const header = ResponseHeader.from(res.headers, res.statusCode || 500);
          resolve(new ResponseData(header, buffer));
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  public async getReadableStream(params: {
    url: URL;
    headers?: Record<string, string | undefined>;
    abortController?: AbortController;
  }): Promise<Readable> {
    return new Promise<Readable>((
      resolve: (stream: Readable) => void,
      reject: (error: Error) => void,
    ) => {
      const requestOptions: https.RequestOptions = {
        hostname: params.url.hostname,
        port: params.url.port || 443,
        path: params.url.pathname + params.url.search,
        method: 'GET',
        headers: {
          ...params.headers,
          'User-Agent': this.options.userAgent,
        },
        agent: this.agent,
      };

      const req = https.request(requestOptions, (res) => {
        resolve(res);
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (params.abortController) {
        params.abortController.signal.addEventListener('abort', () => {
          req.destroy();
        });
      }

      req.end();
    });
  }

  close() {
    this.agent.destroy();
  }
}
