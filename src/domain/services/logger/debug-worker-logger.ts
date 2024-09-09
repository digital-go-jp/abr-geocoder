/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 * Copyright (c) 2024 NEKOYASAN
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

export class DebugWorkerLogger {

  private static instance: DebugWorkerLogger | undefined;

  static readonly getInstance = (): DebugWorkerLogger => {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new DebugWorkerLogger();
    return this.instance;
  }

  debug(message: string, ...meta: any[]) {
    console.log("DEBUG", message, ...meta);
  }
  info(message: string, ...meta: any[]) {
    console.log("INFO", message, ...meta);
  }
  warn(message: string, ...meta: any[]) {
    console.log("WARN", message, ...meta);
  }
  data(message: string, ...meta: any[]) {
    console.log("DATA", message, ...meta);
  }
  notice(message: string, ...meta: any[]) {
    console.log("NOTICE", message, ...meta);
  }
}
