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
import { RegExpEx } from "@domain/services/reg-exp-ex";
import { toHankakuAlphaNum } from "../to-hankaku-alpha-num";

export class CharNode {
  next?: CharNode;

  constructor(
    public originalChar?: string,
    public char?: string,
    public ignore: boolean = false,
  ) {
    if (this.char === undefined) {
      this.char = this.originalChar;
    }
  }

  concat(...another: (CharNode | undefined)[]): CharNode | undefined {
    if (!another) {
      return this.clone();
    }
    const head = this.clone();
    let tail: CharNode | undefined = head;
    for (const other of another) {
      if (!other) {
        continue;
      }
      while (tail && tail.next && tail.next.next) {
        tail = tail.next.next;
      }
      if (tail?.next) {
        tail = tail.next;
      }
      if (tail) {
        tail.next = other;
        tail = tail.next;
      }
    }
    return head;
  }

  replaceAll(search: string | RegExp, replaceValue: string | Function): CharNode | undefined {
    let root: CharNode | undefined = this.clone();

    this.toProcessedString().replaceAll(search, (match: string,  ...args: any[]): string => {

      let repValue = (() => {
        if (typeof replaceValue === 'function') {
          return replaceValue(match);
        } else {
          return replaceValue;
        }
      })();

      const hasNamedGroups = Array.isArray(args.at(-1));
      const offset: number = hasNamedGroups ? args.at(-3) : args.at(-2);
      
      // グルーピングをしている場合、repValueに適用する
      if (hasNamedGroups) {
        for (const [key, value] of Object.entries(args.at(-1))) {
          repValue = repValue.replaceAll(key, value);
        }
      }
      const N = args.length;
      for (let i = 0; i < N - 2 - (hasNamedGroups ? 1 : 0); i++) {
        repValue = repValue.replaceAll(`$${i + 1}`, args[i]);
      }
      
      root = root?.splice(offset, match.length, repValue);

      return repValue;
    });
    
    return root;
  }

  replace(search: string | RegExp, replaceValue: string | Function): CharNode | undefined {
    let root: CharNode | undefined = this.clone();

    // 正規表現でマッチした位置に値する部分を CharNode を使って置換していく
    // オリジナルの文字は残す
    this.toProcessedString().replace(search, (match: string,  ...args: any[]): string => {
      let repValue = (() => {
        if (typeof replaceValue === 'function') {
          return replaceValue(match);
        } else {
          return replaceValue;
        }
      })();

      const hasNamedGroups = typeof args.at(-1) === 'object';
      const offset: number = hasNamedGroups ? args.at(-3) : args.at(-2);

      // グルーピングをしている場合、repValueに適用する
      if (hasNamedGroups) {
        for (const [key, value] of Object.entries(args.at(-1))) {
          repValue = repValue.replaceAll(key, value);
        }
      }
      const N = args.length;
      for (let i = 0; i < N - 2 - (hasNamedGroups ? 1 : 0); i++) {
        repValue = repValue.replaceAll(`$${i + 1}`, args[i]);
      }
      
      root = root?.splice(offset, match.length, repValue);

      return repValue;
    });
    
    return root;
  }

  toOriginalString(): string {
    const buffer = [];
    let head: CharNode | undefined = this;
    while (head) {
      if (head.originalChar !== undefined && head.originalChar !== null && head.originalChar !== '') {  
        buffer.push(head.originalChar);
      }
      head = head.next;
    }
    return toHankakuAlphaNum(buffer.join(''));
  }

  toProcessedString(): string {
    const buffer = [];
    let head: CharNode | undefined = this;
    while (head) {
      if (!head.ignore && head.char !== undefined && head.char !== null && head.char !== '') {  
        buffer.push(head.char);
      }
      head = head.next;
    }
    return buffer.join('');
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  toJSON() {
    const buffer = [];
    let head: CharNode | undefined = this;
    while (head) {
      if (head.char !== undefined && head.char !== null && head.char !== '') {  
        buffer.push({
          org: head.originalChar,
          char: head.char,
          ignore: head.ignore,
        });
      }
      head = head.next;
    }
    return buffer;
  }

  clone(): CharNode {
    const root = new CharNode();
    let tail: CharNode | undefined = root;
    let node: CharNode | undefined = this;
    while (node) {
      tail.next = new CharNode(node.originalChar, node.char, node.ignore);
      tail = tail?.next;
      node = node.next;
    }
    return root.next!;
  }

  split(search: string | RegExp, limit?: number): CharNode[] {
    if (limit) {
      if (limit === 0) {
        return [];
      }
      if (limit < 0 || !Number.isInteger(limit)) {
        throw new TypeError('limit for split() must be a non-negative integer');
      }
    }
    let count = limit || Number.POSITIVE_INFINITY;

    const results: CharNode[] = [];
    if (search === '') {
      let head: CharNode | undefined = this;
      while (head && count > 0) {
        count--;
        const headNext: CharNode | undefined = head.next;
        head.next = undefined;
        results.push(head);
        head = headNext;
      }
      return results;
    }


    // 正規表現でマッチした位置に値する部分を CharNode を使って置換していく
    // オリジナルの文字は残す
    const regexp: RegExp = (() => {
      if (typeof search === 'string') {
        return RegExpEx.create(search, 'g');
      } else if (!search.global) {
          throw new TypeError('The regexp for split() must have a global flag');
      }
      return search;
    })();

    let match: RegExpExecArray | null;
    const txt = this.toProcessedString();
    let root: CharNode | undefined = this.clone();
    let buffer = new CharNode();
    let tail: CharNode | undefined = buffer;
    let i = 0;
    while ((match = regexp.exec(txt)) !== null && count > 0) {
      while (i < match.index && tail && root) {
        
        const rootNext: CharNode | undefined = root.next;
        tail.next = root;
        tail = tail.next;
        tail.next = undefined;
        root = rootNext;

        if (root?.ignore) {
          continue;
        }
        i++;
      }
      if (buffer.next) {
        results.push(buffer.next);
        tail = buffer;
        root = root?.next;
        i++;
      }
      while (i < regexp.lastIndex - 1 && root) {
        root = root?.next;
        if (root?.ignore) {
          continue;
        }
        i++;
      }
      count--;
    }
    if (root && count > 0) {
      results.push(root);
    }
    
    return results;
  }

  splice(start: number, deleteCount: number = 0, replaceValue: string | undefined = undefined) {
    const root = new CharNode('', '');
    root.next = this;

    let head: CharNode | undefined = root.next;
    let tail: CharNode | undefined = root;
    for (let i = 0; i < start; i++) {
      while (head && head?.ignore) {
        tail = tail?.next;
        head = head?.next;
      }
      tail = tail?.next;
      head = head?.next;
    }

    if (!tail) {
      return root.next;
    }

    // replaceValueがない場合
    if (replaceValue === undefined || replaceValue === '') {
      for (let i = 0; i < deleteCount; i++) {
        while (head && head?.ignore) {
          // tail = tail?.next;
          head = head?.next;
        }
        tail!.next = new CharNode(head?.char, '', true);
        tail = tail?.next;
        head = head?.next;
      }
      tail!.next = head;
      return root.next;
    }


    let newValue : CharNode | undefined = CharNode.create(replaceValue);

    while ((deleteCount > 0) && head && newValue) {
      while (head && head?.ignore) {
        tail = tail?.next;
        head = head?.next;
      }
      head!.char = newValue!.char;
      head = head?.next;
      tail = tail?.next;
      newValue = newValue?.next;
      deleteCount--;
    }
    if (deleteCount > 0) {
      // 消す文字列の方が長い
      while ((deleteCount > 0) && head) {
        tail!.originalChar += head!.originalChar!;
        head.char = '';
        head.ignore = true;
        head = head.next;
        deleteCount--;
      }
    } else {
      // 置換する文字列の方が長い or 同等
      while (newValue) {
        tail!.next = new CharNode('', newValue.char);
        tail = tail?.next;
        newValue = newValue.next;
      }
      // tail.next = newValue;
    }
    if (tail) {
      tail!.next = head;
    }

    return root.next;
  }

  moveToNext(targetChar?: string): CharNode | undefined {
    let pointer: CharNode | undefined = this;
    while (pointer) {
      while (pointer && pointer.ignore) {
        pointer = pointer.next;
      }
      if (!targetChar || pointer?.char === targetChar) {
        break;
      }
      pointer = pointer?.next;
    }
    return pointer;
  }
  
  static readonly fromString = (value: string): CharNode | undefined => {
    try {
      const parsedValue = JSON.parse(value);
      if (typeof parsedValue === 'string') {
        return CharNode.create(parsedValue);
      }
      if (Array.isArray(parsedValue)) {
        const root = new CharNode('', '');
        let head = root;
        for (const value of parsedValue as Iterable<{
          org: string;
          char: string;
          ignore: boolean;
        }>) {
          head.next = new CharNode(value.org, value.char, value.ignore);
          head = head.next;
        }
        return root.next;
      }
      throw 'unexpected format';
    } catch(e) {
      throw 'unexpected format';
    }
  }

  // address を CharNode に変換する
  static create(address: string): CharNode | undefined {
    let head: CharNode | undefined = undefined;
    let isInParenthesis = false;
    for (let i = address.length - 1; i >= 0; i--) {
      const prevHead = head;
      if (address[i] === ')') {
        isInParenthesis = true;
      } 
      head = new CharNode(address[i], address[i], isInParenthesis);
      head.next = prevHead;

      if (address[i] === '(') {
        isInParenthesis = false;
      } 
    }
    return head;
  }
}
