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


interface EventListener {
  (evt: Event): void;
}

interface EventListenerObject {
  handleEvent(object: Event): void;
}

interface EventListenerOptions {
  /** Not directly used by Node.js. Added for API completeness. Default: `false`. */
  capture?: boolean;
}

interface AddEventListenerOptions extends EventListenerOptions {
  /** When `true`, the listener is automatically removed when it is first invoked. Default: `false`. */
  once?: boolean;
  /** When `true`, serves as a hint that the listener will not call the `Event` object's `preventDefault()` method. Default: false. */
  passive?: boolean;
  /** The listener will be removed when the given AbortSignal object's `abort()` method is called. */
  signal?: AbortSignal;
}

type ListenerInfo = {
  listener: EventListener | EventListenerObject;
  options?: AddEventListenerOptions | boolean;
}

export class AbrAbortSignal implements AbortSignal {
  private cancelled = false;
  private cancelledReason: any | null = null;
  private listeners: Map<string, Set<ListenerInfo>> = new Map();

  addEventListener(type: string, listener: EventListener | EventListenerObject, options?: AddEventListenerOptions | boolean): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    const listenerSets = this.listeners.get(type)!;
    listenerSets.add({
      listener,
      options,
    });
  }
  dispatchEvent(event: Event): boolean {
    if (!this.listeners.has(event.type)) {
      return false;
    }

    if (event.type === 'abort') {
      this.cancelled = true;
      this.cancelledReason = event;

      if (this.onabort) {
        this.onabort(event);
      }
    }

    const listenerSets = this.listeners.get(event.type)!;
    Array.from(listenerSets.values()).forEach((info) => {
      if ('handleEvent' in info.listener) {
        info.listener.handleEvent(event);
      } else {
        info.listener(event);
      }
      // once 以外は使う可能性がないので、サポートしない
      if (typeof info.options === 'object' && info.options.once === true) {
        listenerSets.delete(info);
      }
    });
    return true;
  }

  removeEventListener(type: string, listener: EventListener | EventListenerObject, _options?: EventListenerOptions | boolean): void {
    if (!this.listeners.has(type)) {
      return;
    }

    const listenerSets = this.listeners.get(type)!;
    Array.from(listenerSets.values()).forEach((info) => {
      if (info.listener !== listener) {
        return;
      }
      listenerSets.delete(info);
    });
  }

  onabort: ((this: AbortSignal, event: Event) => any) | null = null;
  
  throwIfAborted(): void {
    if (!this.cancelled) {
      return;
    }
    throw new Error('abort');
  }

  get reason(): any {
    return this.cancelledReason;
  }

  get aborted(): boolean {
    return this.cancelled;
  }
}

export class AbrAbortController implements AbortController {
  private readonly abrSignal = new AbrAbortSignal();

  get signal(): AbortSignal {
    return this.abrSignal;
  }

  abort() {
    this.abrSignal.throwIfAborted();
    this.abrSignal.dispatchEvent(new Event('abort'));
  }
}