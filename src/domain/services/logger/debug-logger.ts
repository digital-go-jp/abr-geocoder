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
import winston from 'winston';
import path from 'node:path';

export class DebugLogger {

  private static instance: DebugLogger | undefined;

  static readonly getInstance = (): DebugLogger => {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new DebugLogger();
    return this.instance;
  };

  private readonly logger: winston.Logger;
  
  private constructor() {
    const dirname = path.normalize(path.join(__dirname, '..', '..', '..', '..'));

    this.logger = winston.createLogger({
      transports: [
        new winston.transports.File({
          dirname,
          filename: 'log.txt',
        }),
      ],
    });
  }
  debug(message: string, ...meta: any[]) {
    setImmediate(() => {
      this.logger.debug(message, ...meta);
    });
  }
  info(message: string, ...meta: any[]) {
    setImmediate(() => {
      this.logger.info(message, ...meta);
    });
  }
  warn(message: string, ...meta: any[]) {
    setImmediate(() => {
      this.logger.warn(message, ...meta);
    });
  }
  data(message: string, ...meta: any[]) {
    setImmediate(() => {
      this.logger.data(message, ...meta);
    });
  }
  notice(message: string, ...meta: any[]) {
    setImmediate(() => {
      this.logger.notice(message, ...meta);
    });
  }
}
