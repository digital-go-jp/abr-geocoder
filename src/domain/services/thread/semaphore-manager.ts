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
export class SemaphoreManager {

  static readonly UNLOCKED = 0;
  static readonly LOCKED = 1;

  private readonly semaphore: Int32Array;
  public readonly size: number;

  constructor(
    shared: SharedArrayBuffer,
  ) {
    if (shared.byteLength % Int32Array.BYTES_PER_ELEMENT !== 0) {
      throw new Error("SharedArrayBuffer size must be a multiple of Int32Array element size");
    }
    this.semaphore = new Int32Array(shared);
    this.size = this.semaphore.length;  // = this.semaphore.byteLength / 4
  }

  async enterAwait(idx: number): Promise<number> {

    // idx = idx % this.semaphore.byteLength;
    idx = idx % this.size;

    while (true) {
      if (Atomics.compareExchange(this.semaphore, idx, SemaphoreManager.UNLOCKED, SemaphoreManager.LOCKED) === SemaphoreManager.UNLOCKED) {
        break;
      }
      await Atomics.wait(this.semaphore, idx, SemaphoreManager.LOCKED);
    }
    return idx;
  }

  leave(idx: number) {
    // idx = idx % this.semaphore.byteLength;
    idx = idx % this.size;
    
    Atomics.store(this.semaphore, idx, SemaphoreManager.UNLOCKED);
    // Atomics.compareExchange(this.semaphore, idx, SemaphoreManager.LOCKED, SemaphoreManager.UNLOCKED);
    Atomics.notify(this.semaphore, idx, 1);
  }
}
