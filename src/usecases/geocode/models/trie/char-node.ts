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
import { SPACE } from "@config/constant-values";
import { toHankakuAlphaNum } from "../../services/to-hankaku-alpha-num";

export class CharNode {
  next?: CharNode;
  public originalChar?: string;
  public char?: string;
  public ignore: boolean = false;

  constructor({
    originalChar = undefined,
    char,
    ignore = false,
  }: {
    originalChar?: string;
    char: string;
    ignore?: boolean;
  }) {
    this.originalChar = originalChar;
    this.char = char;
    this.ignore = ignore;

    if (this.originalChar === undefined) {
      this.originalChar = this.char;
    }
  }

  at(position: number): CharNode | undefined {
    position = Math.max(position, 0);

    let head: CharNode | undefined = this.clone();
    let i = 0;
    while (head && i < position) {
      i++;
      head = head.next?.moveToNext();
    }
    return head;
  }

  includes(search: string | RegExp): boolean {
    if (typeof search === 'string') {
      search = new RegExp(search);
    }
    return this.match(search) !== null;
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

  headOf(search: string): CharNode | undefined {
    if (search === '') {
      return this;
    }

    const toString = (charNodeList: (CharNode | undefined)[]): string => {
      const buffer: string[] = [];
      for (const charNode of charNodeList) {
        if (!charNode) {
          break;
        }
        buffer.push(charNode.char!);
      }
      return buffer.join('');
    };

    const searchLen = search.length;
    const buffer = new Array<CharNode | undefined>(search.length);
    let i = 0;
    let head: CharNode | undefined = this;
    while (head && i < searchLen) {
      buffer[i++] = head;
      head = head.next?.moveToNext();
    }
    if (i < searchLen) {
      return undefined;
    }

    while (head) {
      if (toString(buffer) === search) {
        return buffer[0];
      }

      head = head.next?.moveToNext();
      buffer.shift();
      buffer.push(head);
    }
    return undefined;
  }

  replaceAll(
    search: string | RegExp,
    replaceValue: string | ((substring: string, ...args: any[]) => string),
  ): CharNode | undefined {
    let root: CharNode | undefined = this.clone();

    if (typeof search === 'string') {
      if (search !== '?') {
        search = new RegExp(search, 'g');
      } else {
        search = /\?/g;
      }
    }
    const matches = this.toProcessedString().matchAll(search);
    if (!matches) {
      return root;
    }
    
    const matchesArray = Array.from(matches);
    if (matchesArray.length === 0) {
      return root;
    }

    const replacer = (() => {
      if (typeof replaceValue === 'function') {
        return (match: RegExpExecArray) => {
          const args: any[] = [];
          let i = 0;
          while (Object.hasOwn(match, i.toString())) {
            args.push(match[i]);
            i++;
          }
          return replaceValue.apply(this, args as [substring: string, ...args: any[]]);
        };
      } else {
        return () => replaceValue;
      }
    })();

    for (let i = matchesArray.length - 1; i >= 0; i--) {
      const match = matchesArray[i];
      let repValue = replacer(match);

      for (let i = 1; i < match.length; i++) {
        repValue = repValue.replaceAll(`$${i}`, match[i]);
      }

      root = root?.splice(match.index, match[0].length, repValue);
    }
    return root;
  }

  replace(search: string | RegExp, replaceValue: string | ((substring: string, ...args: any[]) => string)): CharNode | undefined {
    let root: CharNode | undefined = this.clone();

    // 正規表現でマッチした位置に値する部分を CharNode を使って置換していく
    // オリジナルの文字は残す
    this.toProcessedString().replace(search, (substring: string, ...args: any[]): string => {
      let repValue = (() => {
        if (typeof replaceValue === 'function') {
          return replaceValue.apply(null, [substring, ...args]);
        } else {
          return replaceValue;
        }
      })();

      const hasNamedGroups = typeof args.at(-1) === 'object';
      const offset: number = hasNamedGroups ? args.at(-3) : args.at(-2);

      // グルーピングをしている場合、repValueに適用する
      if (hasNamedGroups) {
        for (const [key, value] of Object.entries(args.at(-1))) {
          repValue = repValue.replaceAll(key, value as string);
        }
      }
      const N = args.length;
      for (let i = 0; i < N - 2 - (hasNamedGroups ? 1 : 0); i++) {
        repValue = repValue.replaceAll(`$${i + 1}`, args[i]);
      }
      
      root = root?.splice(offset, substring.length, repValue);

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
    const root = new CharNode({
      char: '',
    });
    let tail: CharNode | undefined = root;
    let node: CharNode | undefined = this;
    while (node) {
      tail.next = new CharNode({
        originalChar: node.originalChar,
        char: node.char!,
        ignore: node.ignore,
      });
      tail = tail?.next;
      tail.next = undefined;

      node = node.next;
    }
    return root.next!;
  }

  trimWith(target?: string): CharNode | undefined {
    target = (target || SPACE)[0];
    let foundBody = false;
    let head: CharNode | undefined;
    const stack: CharNode[] = this.split('');
    while (stack.length > 0) {
      // 末尾から取り出す
      const top = stack.pop()!;
      if (!foundBody) {

        // 末尾に target?.char がついている場合はスキップ
        if (top?.char === target) {
          continue;
        }
        if (top.ignore) {
          top.next = head;
          head = top;
          continue;
        }
      }
      foundBody = true;
      // target が連続する場合はスキップ
      if (top.char === target && head?.char === target) {
        continue;
      }
      top.next = head;
      head = top;
    }
    // 先頭のignore部分はスキップ
    let prefixTail: CharNode | undefined;
    const headAnchor = new CharNode({
      char: '',
    });
    headAnchor.next = head;
    while (head && head.ignore) {
      prefixTail = head;
      head = head.next;
    }
    // 先頭にtarget がある場合は排除
    while (head && head.char === target) {
      head = head.next;
    }
    if (prefixTail) {
      prefixTail.next = head;
    } else {
      headAnchor.next = head;
    }

    return headAnchor.next;
  }

  substring(indexStart: number, indexEnd?: number): CharNode | undefined {
    indexStart = Math.max(indexStart, 0);
    
    let i = 0;
    let root: CharNode | undefined = this.clone();
    while (i < indexStart && root) {
      root = root.next?.moveToNext();
      i++;
    }
    if (!root) {
      return;
    }

    const resultHead = root;
    let tail = root;

    while ((indexEnd === undefined || i < indexEnd) && root) {
      const rootNext: CharNode | undefined = root.next;
      tail.next = root;
      tail = tail.next;
      tail.next = undefined;
      
      root = rootNext?.moveToNext();
      i++;
    }
    if (root) {
      root.next = undefined;
    }
    return resultHead;
  }

  match(search: RegExp): {node: CharNode; index: number; lastIndex: number} | undefined {
    
    if (!search.global) {
      search = new RegExp(search, 'g');
    }
    const txt = this.toProcessedString();
    let root: CharNode | undefined = this;
    let i = 0;
    const match: RegExpExecArray | null = search.exec(txt);
    if (!match) {
      return;
    }
    while (i < match.index && root) {
      root = root.next?.moveToNext();
      i++;
    }

    // 開始位置
    const startNode = root;
    const startIndex = i;

    while (i < search.lastIndex && root) {
      root = root.next?.moveToNext();
      i++;
    }
    
    // 終了位置
    return {
      node: startNode!,
      index: startIndex,
      lastIndex: i,
    };
  }
  matchAll(search: RegExp): {node: CharNode; index: number; lastIndex: number}[] {
    
    if (!search.global) {
      search = new RegExp(search, 'g');
    }
    
    const results: {node: CharNode; index: number; lastIndex: number}[] = [];
    
    let match: RegExpExecArray | null;
    const txt = this.toProcessedString();
    let root: CharNode | undefined = this;
    let i = 0;
    while ((match = search.exec(txt)) !== null) {
      let startIndex = i;
      let lastIndex = i;
      let startNode: CharNode = root!;
      while (i < match.index && root) {
        root = root.next?.moveToNext();
        i++;
      }
      if (!root) {
        break;
      }

      // 開始位置
      startNode = root;
      startIndex = i;

      while (i < search.lastIndex && root) {
        root = root.next?.moveToNext();
        i++;
      }
      lastIndex = i;
      
      // 終了位置
      results.push({
        node: startNode!,
        index: startIndex,
        lastIndex,
      });
    }
    
    return results;
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
        return new RegExp(search, 'g');
      } else if (!search.global) {
        return new RegExp(search, 'g');
      }
      return search;
    })();

    let match: RegExpExecArray | null;
    const txt = this.toProcessedString();
    let root: CharNode | undefined = this.clone();
    const buffer = new CharNode({
      char: '',
    });
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
    const root = new CharNode({
      char: '',
    });
    root.next = this;

    let head: CharNode | undefined = root.next;
    let tail: CharNode | undefined = root;
    for (let i = 0; i < start; i++) {
      while (head && head.ignore) {
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
        tail!.next = new CharNode({
          originalChar: head?.char,
          char: '',
          ignore: true,
        });
        tail = tail?.next;
        head = head?.next;
      }
      tail!.next = head;
      return root.next;
    }

    // const newValues: CharNode[] = CharNode.create(replaceValue)?.split('') || [];
    let newIdx = 0;
    const replaceValueLength = replaceValue.length;

    // 消す文字数と挿入する文字数で、共通する文字数分だけ削除する
    while ((deleteCount > 0) && head && newIdx < replaceValueLength) {
      while (head && head?.ignore) {
        tail = tail?.next;
        head = head?.next;
      }
      const headNewChar = new CharNode({
        char: replaceValue[newIdx],
        originalChar: tail?.originalChar,
      });
      newIdx++;

      head!.char = headNewChar.char;
      head = head?.next;
      tail = tail?.next;
      deleteCount--;
    }
    
    // 消す文字列の方が長い
    while ((deleteCount > 0) && head) {
      tail!.originalChar += head!.originalChar!;
      head.char = '';
      head.ignore = true;
      head = head.next;
      deleteCount--;
    }

    // 置換する文字列の方が長い or 同等
    while (newIdx < replaceValueLength) {
      tail!.next = new CharNode({
        originalChar: '',
        char: replaceValue[newIdx],
      });
      newIdx++;
      tail = tail?.next;
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

  release() {
    const nextChar = this.next;
    this.next = undefined;
    nextChar?.release();
  }
  
  static readonly fromString = (value: string): CharNode | undefined => {
    try {
      const parsedValue = JSON.parse(value);
      if (typeof parsedValue === 'string') {
        return CharNode.create(parsedValue);
      }
      if (Array.isArray(parsedValue)) {
        const root = new CharNode({
          char: '',
        });
        let head = root;
        for (const value of parsedValue as Iterable<{
          org: string;
          char: string;
          ignore: boolean;
        }>) {
          head.next = new CharNode({
            originalChar: value.org,
            char: value.char,
            ignore: value.ignore,
          });
          head = head.next;
        }
        return root.next;
      }
      throw 'unexpected format';
    } catch(_) {
      throw 'unexpected format';
    }
  };

  static joinWith(connector: CharNode, ...targets: (CharNode | undefined)[]): CharNode | undefined {
    targets = targets.filter(x => x !== undefined);
    if (targets.length === 0) {
      return undefined;
    }
    if (targets.length === 1) {
      return targets[0];
    }
    let p = targets.shift();
    const head = p;
    while (p?.next) {
      p = p.next;
    }

    while (p && targets.length > 0) {
      p.next = connector.clone();
      while (p.next) {
        p = p.next;
      }
      p.next = targets.shift();
      while (p?.next && p !== p.next) {
        p = p.next;
      }
      // https://github.com/digital-go-jp/abr-geocoder/issues/210
      // 無限ループになる
      // 理由は不明。
      if (p === p.next) {
        p.next = undefined;
      }
    }
    return head;
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
      head = new CharNode({
        originalChar: address[i],
        char: address[i],
        ignore: isInParenthesis,
      });
      head.next = prevHead;

      if (address[i] === '(') {
        isInParenthesis = false;
      } 
    }
    return head;
  }
  
}
