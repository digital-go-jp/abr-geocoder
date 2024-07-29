export class SemaphoreManager {

  static readonly UNLOCKED = 0;
  static readonly LOCKED = 1;

  private readonly semaphore: Int32Array;
  public readonly size: number;

  constructor(
    shared: SharedArrayBuffer,
  ) {
    
    this.semaphore = new Int32Array(shared);
    this.size = this.semaphore.byteLength;
  }

  enterAwait(idx: number): Promise<number> {

    idx = idx % this.semaphore.byteLength;

    return new Promise((resolve: (idx: number) => void) => {
      while (true) {
        if (Atomics.compareExchange(this.semaphore, idx, SemaphoreManager.UNLOCKED, SemaphoreManager.LOCKED) === SemaphoreManager.UNLOCKED) {
          resolve(idx);
          return;
        }
        Atomics.wait(this.semaphore, idx, SemaphoreManager.LOCKED);
      }
    });
  }

  leave(idx: number) {
    idx = idx % this.semaphore.byteLength;
    
    Atomics.compareExchange(this.semaphore, idx, SemaphoreManager.LOCKED, SemaphoreManager.UNLOCKED);
    Atomics.notify(this.semaphore, idx, 1);
  }
}