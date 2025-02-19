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
import { AsyncResource } from 'node:async_hooks';

export class WorkerPoolTaskInfo<DataType, ResultType> extends AsyncResource {
  next: WorkerPoolTaskInfo<DataType, ResultType> | undefined;
  result?: ResultType;
  error?: null | undefined | Error;

  private _isResolved: boolean = false;
  private _isDestroyed: boolean = false;
  private resolve?: (value: ResultType) => void;
  private reject?: (err: Error) => void;

  get isResolved(): boolean {
    return this._isResolved;
  }
  setResolver(fn: (value: ResultType) => void) {
    this.resolve = fn;
  }
  setRejector(fn: (err: Error) => void) {
    this.reject = fn;
  }

  constructor(
    public readonly data: DataType,
  ) {
    super('WorkerPoolTaskInfo');
  }

  private destroy() {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;
    this.emitDestroy();
  }

  emit(): boolean {
    if (!this.isResolved) {
      return false;
    }
    if (this.error) {
      if (this.reject) {
        this.runInAsyncScope(this.reject, this, this.error);
      } else {
        throw this.error;
      }
    } else {
      if (this.resolve) {
        this.runInAsyncScope(this.resolve, this, this.result);
      } else {
        throw new Error(`A resolver is not set for ${this.asyncId()}`);
      }
    }
    this.destroy();
    return true;
  }

  setResult(err: null | undefined | Error, result?: ResultType) {
    this._isResolved = true;
    if (err) {
      this.error = err;
    } else {
      this.result = result;
    }
  }

  done(err: null | undefined | Error, result?: ResultType) {
    if (err) {
      this.setResult(err);
    } else {
      this.setResult(null, result);
    }
    this.emit();

    this.resolve = undefined;
    this.reject = undefined;
    this.error = undefined;
    this.result = undefined;
    this.next = undefined;
    
    this.destroy();
  }
}
// export class WorkerPoolTaskInfo<T, R> extends AsyncResource {

//   constructor(
//     public readonly data: T,
//     public readonly resolve: (value: R) => void,
//     public readonly reject: (err: Error) => void,
//   ) {
//     super('WorkerPoolTaskInfo');
//   }

//   done(err: null | undefined | Error, result?: R) {
//     if (err) {
//       this.runInAsyncScope(this.reject, this, err);
//     } else {
//       this.runInAsyncScope(this.resolve, this, result);
//     }
//     this.emitDestroy();
//   }
// }
