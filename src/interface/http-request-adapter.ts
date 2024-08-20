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
import http2, { ClientSessionRequestOptions, Http2Session } from 'node:http2';

export type HttpHeader = http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader;

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

  static from(headers: HttpHeader): ResponseHeader {

    const contentLength = parseInt(headers[http2.constants.HTTP2_HEADER_CONTENT_LENGTH]?.toString() || '0', 10);
    const statusCode: StatusCodes = parseInt(headers[http2.constants.HTTP2_HEADER_STATUS]?.toString() || '500', 10);
    const eTag = headers[http2.constants.HTTP2_HEADER_ETAG] as string | undefined;
    const lastModified = headers[http2.constants.HTTP2_HEADER_LAST_MODIFIED] as string | undefined;
    const contentRange = headers[http2.constants.HTTP2_HEADER_CONTENT_RANGE] as string | undefined;

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

export class HttpRequestAdapter {
  private session: http2.ClientHttp2Session | undefined;
  private noLongerReconnect: boolean = false;
  private readonly windowSize: number = 2 ** 25; // 初期ウィンドウサイズを2MBに設定
  private readonly timer: NodeJS.Timeout;

  constructor(public readonly options: Required<{
    hostname: string;
    userAgent: string;
    peerMaxConcurrentStreams: number;
  }>) {
    this.connect();
    this.timer = setInterval(() => this.sendPing(), 45000);
  }

  private sendPing() {
    if (!this.session || this.session.closed) {
      return;
    }
    this.session.ping((error: Error | null) => {
      if (error) {
        console.error('ping error', error);
      }
    });
  }
  private connect() {
    this.session = http2.connect(`https://${this.options.hostname}`, {
      peerMaxConcurrentStreams: this.options.peerMaxConcurrentStreams,
    });
    this.session.setMaxListeners(this.options.peerMaxConcurrentStreams);
    this.session.once('session', (session: Http2Session) => {
      console.log(`  ->session connect`);
      session.setLocalWindowSize(this.windowSize);
    });
    this.session.once('close', () => {
      // console.log(`--->session close`);
      this.session?.close();
      this.session = undefined;
      if (this.noLongerReconnect) {
        return;
      }
      console.log(`  ->retry`);
      setTimeout(() => this.connect(), 1000);
    });
    this.session.once('error', () => {
      console.log(`--->session error (${process.pid})`);
      this.session = undefined;
      if (this.noLongerReconnect) {
        return;
      }
      setTimeout(() => this.connect(), 1000);
    });
  }

  public async getJSON(params: {
    url: string;
    headers?: Record<string, string>;
  }): Promise<JsonResponseData> {
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
    url: string;
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
    url: string;
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
    url: string;
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
    url: string;
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
    url: string;
    method: 'GET' | 'HEAD';
    encoding: BufferEncoding;
    headers?: Record<string, string | undefined>;
  }): Promise<ResponseData> {

    const urlObj = new URL(url);
    const reqParams = Object.assign(
      headers,
      {
        [http2.constants.HTTP2_HEADER_METHOD]: method.toUpperCase(),
        [http2.constants.HTTP2_HEADER_PATH]: [
          urlObj.pathname,
          urlObj.search,
        ].join(''),
        [http2.constants.HTTP2_HEADER_USER_AGENT]: this.options.userAgent,
      },
    );

    await new Promise((resolve: (_?: void) => void) => {
      const waiter = () => {
        if (this.noLongerReconnect || this.session) {
          resolve();
          return;
        }
        setTimeout(() => waiter(), 100);
      };
      waiter();
    });
    if (!this.session) {
      return Promise.reject('Session is undefined');
    }
    const req: http2.ClientHttp2Stream = this.session.request(
      reqParams,
      {
        endStream: false,
      },
    );
    req.setEncoding(encoding);

    return new Promise((
      resolve: (data: ResponseData) => void,
    ) => {
      req.once('response', (headers) => {
        const header = ResponseHeader.from(headers);
        const buffer: Buffer[] = [];

        req.on('data', (chunk: Buffer) => {

          // データ受信の際にウィンドウサイズを動的に調整
          const currentWindowSize = req.state.localWindowSize;
          const receivedDataSize: number = chunk.length;

          // ウィンドウサイズが一定量以下になった場合に拡張
          if (currentWindowSize && currentWindowSize < this.windowSize / 2) {
            const newWindowSize: number = this.windowSize - currentWindowSize + receivedDataSize;
            req.session?.setLocalWindowSize(newWindowSize);
            // console.log(`===>new window size: ${(newWindowSize / (1024 ** 2)).toFixed(1)}MB`);
          } 
          buffer.push(chunk);
        });

        req.once('end', () => {
          req.removeAllListeners();
          resolve(new ResponseData(header, buffer));
        });
      });
    });
  }

  public async getReadableStream({
    url,
    headers = {},
    abortController,
  }: {
    url: string;
    headers?: Record<string, string | undefined>;
    abortController?: AbortController;
  }) {

    const urlObj = new URL(url);
    const requestOptions: ClientSessionRequestOptions = {
      endStream: false,
      signal: abortController?.signal,
    };

    await new Promise((
      resolve: (_?: void) => void,
      reject: (error: Error) => void,
    ) => {
      const timeout = setTimeout(() => reject(new Error('Session initialization timeout')), 5000);
      const waiter = () => {
        if (this.noLongerReconnect || this.session) {
          clearTimeout(timeout);
          resolve();
        } else {
          setImmediate(waiter);
        }
      };
      waiter();
    });
    if (!this.session) {
      return Promise.reject(new Error('No session available'));
    }
    const req: http2.ClientHttp2Stream = this.session.request(Object.assign(
      headers,
      {
        [http2.constants.HTTP2_HEADER_PATH]: [
          urlObj.pathname,
          urlObj.search,
        ].join('?'),
        [http2.constants.HTTP2_HEADER_METHOD]: 'GET',
        [http2.constants.HTTP2_HEADER_USER_AGENT]: this.options.userAgent,
      },
    ), requestOptions);
    const onSessionClose = () => {
      console.log(`--->req.close`);
      req.close();
    };
    this.session.on('close', onSessionClose);

    req.once('error', (err) => {
      console.error('Stream error:', err);
    });

    req.once('end', () => {
      req.removeAllListeners();
      this.session?.removeListener('close', onSessionClose);
    });

    return req;


    // ファイルの継続ダウンロードを実装するため、レスポンスに応じてWritableを返す用に
    // return new Promise((resolve: (stream: Writable) => void) => {
    //   req.once('response', headers => {
    //     const dst = factory(ResponseHeader.from(headers));

    //     req.on('data', (chunk: Buffer) => dst.write(chunk));
    //     req.once('end', () => {
    //       dst.end();
    //       req.removeAllListeners();
    //     });

    //     resolve(dst);
    //   });
    // })
  }

  close() {
    this.noLongerReconnect = true;
    this.session?.close();
    clearInterval(this.timer);
  }
}
