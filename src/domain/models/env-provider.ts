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
import { RegExpEx } from '@domain/services/reg-exp-ex';
import os from 'node:os';
import path from 'node:path';

export class EnvProvider {
  static readonly DEFAULT_ABRG_DIR: string = path.join(os.homedir(), '.abr-geocoder');
  static readonly isDebug: boolean = (() => {
    return process.env.NODE_ENV?.startsWith('test') || false;
  })();
  
  public readonly hostname: string = 'dataset.address-br.digital.go.jp';
  public readonly userAgent: string = 'curl/7.81.0';
  public readonly nodeRuntimeVersion: number[];

  constructor() {
    this.nodeRuntimeVersion = Array
      .from(process.version.matchAll(RegExpEx.create('([0-9]+)', 'g')))
      .map(match => parseInt(match[0]));
  }

  availableParallelism() {
    return this.nodeRuntimeVersion[0] > 18 ? os.availableParallelism() : os.cpus().length;
  }
}
