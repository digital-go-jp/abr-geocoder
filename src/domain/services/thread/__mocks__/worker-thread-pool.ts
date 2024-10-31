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
import { MatchLevel } from '@domain/types/geocode/match-level';
import { jest } from '@jest/globals';
import EventEmitter from 'events';

const originalModule = jest.requireActual('@domain/services/thread/worker-thread-pool');

class MockWorkerThreadPool extends EventEmitter {
  run = jest.fn().mockImplementation((...args: any) => {
    if (args[0].address === '/abr-geocoder/passthrough') {
      return Promise.resolve({
        input: {
          data: args[0],
        },
        match_level: MatchLevel.UNKNOWN.str,
      });
    }

    return Promise.reject('unimplemented yet');
  });

  close = jest.fn();
}
const WorkerThreadPool = {
  create: jest.fn().mockImplementation(() => {
    return Promise.resolve(new MockWorkerThreadPool());
  }),
};

module.exports = {
  ...Object.assign({}, originalModule),
  WorkerThreadPool,
};
