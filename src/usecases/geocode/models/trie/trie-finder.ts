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
import crc32Lib from "@domain/services/crc32-lib";
import { deserialize, serialize } from "node:v8";
import { CharNode } from "./char-node";

export interface ITrieNode<T> {
  itemHashes: Set<string> | undefined;
  children: Map<string, ITrieNode<T>>;
}

export class TrieFinderResult<T> {
  public readonly info: T | undefined;
  public readonly unmatched: CharNode | undefined;
  public readonly depth: number;
  public readonly ambiguous: boolean;

  constructor(params: {
    info: T | undefined;
    unmatched: CharNode | undefined;
    depth: number;
    ambiguous: boolean;
  }) {
    this.info = params.info;
    this.unmatched = params.unmatched;
    this.depth = params.depth;
    this.ambiguous = params.ambiguous;
    Object.freeze(this);
  }
}

type InternalResult = {
  itemHash: string | undefined;
  unmatched: CharNode | undefined;
  depth: number;
  
  // fuzzy や extraChallenges を使った場合
  // 結果が間違えている可能性があるとき true
  ambiguous: boolean;
};

function createTrieNode<T extends {}>(): ITrieNode<T[]> {
  const result: ITrieNode<T[]> = {
    itemHashes: undefined,
    children: new Map(),
  };
  return result;
}

export class TrieAddressFinder<T> {
  protected root: ITrieNode<T[]> = createTrieNode();
  protected items: Map<string, T> = new Map();

  export(): Buffer {
    return serialize({
      tree: this.root,
      items: this.items,
    });
  }

  import(data: Buffer) {
    const results = deserialize(data);
    this.root = results.tree;
    this.items = results.items;
  }

  append({
    key,
    value,
  }: {
    key: string | number | CharNode;
    value: T
  }) {
    let parent = this.root;

    if (key instanceof CharNode) {
      let head: CharNode | undefined = key;
      while (head) {
        const trie = parent.children.get(head.char!) || createTrieNode();
        parent.children.set(head.char!, trie);
        parent = trie;
        head = head.next;
      }
    } else {
      for (const char of key.toString()) {
        const trie = parent.children.get(char) || createTrieNode();
        parent.children.set(char, trie);
        parent = trie;
      }
    }

    const itemHash = this.toItemHash(value);
    if (!this.items.has(itemHash)) {
      this.items.set(itemHash, value);
    }
    parent.itemHashes = parent.itemHashes || new Set<string>();
    parent.itemHashes.add(itemHash);
  }

  private toItemHash(value: T): string {
    return crc32Lib.fromString(JSON.stringify(value));
  }

  find({ 
    // 検索対象の文字列
    target,

    // ワイルドカードマッチの1文字
    fuzzy,

    // trueのとき、中間でマッチした結果も含めて返す
    partialMatches,

    // マッチしなかったときに、もう1文字を試してみる
    extraChallenges,
  }: {
    fuzzy: string | undefined;
    target: CharNode;
    partialMatches?: boolean;
    extraChallenges?: string[];
  }): TrieFinderResult<T>[] {

    let node: CharNode | undefined = target;
    node = node.moveToNext();

    const searchResults = this.traverse({
      parent: this.root,
      node,
      partialMatches: partialMatches === true,
      extraChallenges,
      fuzzy,
      depth: 0,
    });
    if (!searchResults || searchResults.size === 0) {
      return [];
    }

    const results: TrieFinderResult<T>[] = [];

    for (const [itemHash, internalResult] of searchResults.entries()) {
      const item = this.items.get(itemHash);
      if (internalResult.depth === 0) {
        continue;
      }
      results.push(
        new TrieFinderResult<T>({
          info: item,
          unmatched: internalResult.unmatched,
          depth: internalResult.depth,
          ambiguous: internalResult.ambiguous,
        }),
      );
    }

    return results;
  }

  private traverse({
    parent,
    node,
    partialMatches,
    extraChallenges,
    fuzzy,
    depth,
  }: {
    fuzzy: string | undefined;
    parent: ITrieNode<T[]> | undefined;
    node: CharNode | undefined;
    partialMatches: boolean;
    extraChallenges?: string[];
    depth: number;
  }): Map<string, InternalResult> | undefined {

    // ignoreフラグが指定されている場合、スキップする
    if (node && node.ignore) {
      node = node.moveToNext();
      return this.traverse({
        parent,
        node,
        partialMatches,
        extraChallenges,
        fuzzy,
        depth,
      });
    }

    if (!parent) {
      return;
    }

    // searchChar が parent.children にある場合は、
    // そのまま探索する
    if (node?.char && parent.children.has(node.char)) {
      const parent2 = parent.children.get(node.char);
      const others = this.traverse({
        fuzzy,
        parent: parent2,
        node: node.next,
        partialMatches,
        extraChallenges,
        depth: depth + 1,
      });

      // 中間結果を含まない場合は、情報を返す
      if (!partialMatches || !others) {
        return others;
      }

      // 中間結果を含む場合、または、
      // 子ノードで見つからなかったけど、それよりも親ノードで部分一致する場合、
      // その情報を返す。
      parent?.itemHashes?.forEach(itemHash => {
        if (others.has(itemHash)) {
          return;
        }
        others.set(itemHash, {
          itemHash,
          unmatched: node,
          depth,
          ambiguous: false,
        });
      });
      return others;
    }

    // fuzzyが来た場合、全ての可能性を探索する
    if (node && node.char === fuzzy) {
      const results: Map<string, InternalResult> = new Map();
      for (const child of parent.children.values()) {
        const others = this.traverse({
          fuzzy,
          parent: child,
          node: node.next,
          partialMatches,
          extraChallenges,
          depth: depth + 1,
        });
        others?.forEach(other => {
          if (!other.itemHash || results.has(other.itemHash)) {
            return;
          }
          // extraChallengeをした結果
          // fuzzy が unmatched の最初に来るときは、fuzzy を取り除く
          if (other.unmatched && other.unmatched.char === fuzzy) {
            other.unmatched = other.unmatched.next!;
          }
          other.ambiguous = true;
          results.set(other.itemHash, other);
        });
      }
    
      // 現在のノードに情報がある場合は extraChallenge をしない
      if (parent.itemHashes) {
        parent.itemHashes.forEach(itemHash => {
          if (results.has(itemHash)) {
            return;
          }
          results.set(itemHash, {
            itemHash,
            unmatched: node,
            depth,
            ambiguous: false,
          });
        });
      }
      return results;
    }


    // これ以上、探索する文字がない場合は、現時点の情報を返す
    const results: Map<string, InternalResult> = new Map();

    // 現在のノードに情報がある場合は extraChallenge をしない
    if (parent.itemHashes) {
      parent.itemHashes.forEach(itemHash => {
        results.set(itemHash, {
          itemHash,
          unmatched: node,
          depth,
          ambiguous: false,
        });
      });
      return results;
    }

    // extraChallenges が指定されている場合、もう１文字を試してみる
    if (depth > 0 && extraChallenges && extraChallenges.length > 0) {
      for (const extraWord of extraChallenges) {
        if (!parent.children.has(extraWord.at(0) || '')) {
          continue;
        }

        const newChallenges: string[] = [];
        if (extraWord.length > 1) {
          newChallenges.push(extraWord.substring(1));
        }

        const others = this.traverse({
          fuzzy,
          parent: parent.children.get(extraWord.at(0) || ''),
          node,
          partialMatches,
          extraChallenges: newChallenges.length > 0 ? newChallenges : undefined,
          depth: depth + 1,
        });

        others?.forEach(other => {
          if (!other.itemHash || results.has(other.itemHash)) {
            return;
          }
          other.ambiguous = true;
          results.set(other.itemHash, other);
        });
      }
    }
    return results;
  }
}
