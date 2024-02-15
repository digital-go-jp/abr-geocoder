import { Trie } from '@domain/trie';
import { RegExpEx } from './reg-exp-ex';
import { NUMRIC_SYMBOLS } from '@settings/constant-values';
import { number2kanji } from '@geolonia/japanese-numeral';
import { kan2num } from './kan2num';

class CharListNode {
  readonly orgChar: string;
  readonly searchChar: string;
  next: CharListNode | undefined;

  constructor({
    orgChar,
    searchChar,
  }: {
    orgChar: string;
    searchChar: string;
  }) {
    this.orgChar = orgChar;
    this.searchChar = searchChar;
  }

  static readonly toString = (node: CharListNode | undefined): string => {
    const buffer: string[] = [];

    while (node) {
      buffer.push(node.orgChar);
      node = node.next;
    }

    return buffer.join('');
  };

  static readonly release = (node: CharListNode | undefined) => {
    while (node) {
      const nextNode = node.next;
      node.next = undefined;
      node = nextNode;
    }
  };
}

export class TrieFinderResult<T> {
  public readonly info: T | undefined;
  public readonly unmatched: string;

  constructor(params: { info: T | undefined; unmatched: string }) {
    this.info = params.info;
    this.unmatched = params.unmatched;
    Object.freeze(this);
  }
}

export class TrieFinder<T> {
  private readonly root: Trie<T>;
  private readonly fuzzy: string | undefined;

  constructor({
    fuzzy,
    rows,
    preprocessor,
  }: {
    fuzzy: string | undefined;
    rows: T[];
    preprocessor: (row: T) => string;
  }) {
    this.fuzzy = fuzzy;
    this.root = this.build({
      preprocessor,
      rows,
    });
  }

  private build({
    preprocessor,
    rows,
  }: {
    preprocessor: (row: T) => string;
    rows: T[];
  }): Trie<T> {
    const treeTop = new Trie<T>();

    rows.forEach((row: T) => {
      let parent = treeTop;
      const word = preprocessor(row);

      for (const char of word) {
        const trie = parent.children.get(char) || new Trie<T>();
        parent.children.set(char, trie);
        parent = trie;
      }
      parent.info = row;
    });

    return treeTop;
  }

  find({ target }: { target: string }): TrieFinderResult<T> | undefined {
    const head = new CharListNode({
      orgChar: '',
      searchChar: '',
    });

    let tail = head;

    for (const orgChar of target) {
      tail.next = new CharListNode({
        orgChar,
        searchChar: orgChar,
      });
      tail = tail.next;
    }

    const result = this.traverse({
      parent: this.root,
      node: head.next,
    });

    CharListNode.release(head);

    return result;
  }

  private traverse({
    parent,
    node,
  }: {
    parent: Trie<T> | undefined;
    node: CharListNode | undefined;
  }): TrieFinderResult<T> | undefined {
    if (!parent || !node) {
      if (parent?.info) {
        return new TrieFinderResult<T>({
          info: parent.info,
          unmatched: CharListNode.toString(node),
        });
      }
      return undefined;
    }

    // searchChar が parent.children にある場合は、
    // そのまま探索する
    if (parent.children.has(node.searchChar)) {
      const result = this.traverse({
        parent: parent.children.get(node.searchChar),
        node: node.next,
      });

      if (result) {
        return result;
      }
      if (!parent.info) {
        return undefined;
      }
      return new TrieFinderResult<T>({
        info: parent.info,
        unmatched: CharListNode.toString(node),
      });
    }

    // 数字の場合、漢数字に変換して探索を試みる
    if (RegExpEx.create(`[${NUMRIC_SYMBOLS}]`).test(node.searchChar)) {
      const kanjiNum = number2kanji(parseInt(kan2num(node.searchChar)));

      const result = this.traverse({
        parent: parent.children.get(kanjiNum),
        node: node.next,
      });

      if (result) {
        return result;
      }

      // 数字の場合、部分マッチしてしまうので、ここでは情報を返さない
      return undefined;
    }

    // fuzzyが来た場合、全ての可能性を探索する
    if (node.searchChar === this.fuzzy) {
      for (const child of parent.children.values()) {
        const result = this.traverse({
          parent: child,
          node: node.next,
        });
        if (result) {
          return result;
        }
      }

      // 見つからなかったら、現在位置までの情報を返す
      if (parent.info) {
        return new TrieFinderResult<T>({
          info: parent.info,
          unmatched: CharListNode.toString(node),
        });
      }
      return undefined;
    }

    // DASHが来た場合、「丁目」「丁」「番地」「番」「号」を全部試す
    for (const possibility of [
      ['丁', '目'],
      ['丁'],
      ['番', '地'],
      ['番'],
      ['号'],
    ]) {
      let pointer: Trie<T> | undefined = parent;
      for (const char of possibility) {
        if (!pointer?.children.has(char)) {
          pointer = undefined;
          break;
        }
        pointer = pointer?.children.get(char);
      }

      // DASHの部分が、possibilityの1語 or 2語にマッチしたので、継続して探索する
      const result = this.traverse({
        parent: pointer,
        node: node.next,
      });

      // 見つかった
      if (result) {
        return result;
      }
    }

    // 見つからなかったら、現在位置までの情報を返す
    if (parent.info) {
      return new TrieFinderResult<T>({
        info: parent.info,
        unmatched: CharListNode.toString(node),
      });
    }
    return undefined;
  }
}
