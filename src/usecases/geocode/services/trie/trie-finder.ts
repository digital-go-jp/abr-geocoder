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
import { deserialize, serialize } from "node:v8";
import { CharNode } from "./char-node";

export class TrieFinderResult<T> {
  public readonly info: T | undefined;
  public readonly unmatched: CharNode;
  public readonly depth: number;
  public readonly ambiguous: boolean;

  constructor(params: {
    info: T | undefined;
    unmatched: CharNode;
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

type InternalResult<T> = {
  info: T | undefined;
  unmatched: CharNode;
  depth: number;
  
  // fuzzy や extraChallenges を使った場合
  // 結果が間違えている可能性があるとき true
  ambiguous: boolean;
}

// export class TrieNode<T> {
//   info: T | undefined;
//   children = new Map<string, TrieNode<T>>();
// }

export interface ITrieNode<T> {
  info: T | undefined;
  children: Map<string, ITrieNode<T>>;
}

function createTrieNode<T>(): ITrieNode<T[]> {
  const result: ITrieNode<T[]> = {
    info: undefined,
    children: new Map(),
  };
  return result;
}

export class TrieAddressFinder<T> {
  private root: ITrieNode<T[]> = createTrieNode();

  export(): Buffer {
    return serialize(this.root);
  }

  import(data: Buffer) {
    this.root = deserialize(data);
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
    parent.info = parent.info || [];
    parent.info.push(value);
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
   }): TrieFinderResult<T>[] | undefined {

    let node: CharNode | undefined = target;
    while (node && node.ignore) {
      node = node.next;
    }

    const results = this.traverse({
      parent: this.root,
      node,
      partialMatches: partialMatches === true,
      extraChallenges,
      fuzzy,
      depth: 0,
    });

    return results?.map(result => {
      return new TrieFinderResult<T>({
        info: result.info,
        unmatched: result.unmatched,
        depth: result.depth,
        ambiguous: result.ambiguous,
      });
    });
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
  }): InternalResult<T>[] | undefined {

    // ignoreフラグが指定されている場合、スキップする
    if (node && node.ignore) {
      while (node && node.ignore) {
        node = node.next;
      }
      return this.traverse({
        parent,
        node,
        partialMatches,
        extraChallenges,
        fuzzy,
        depth,
      });
    }

    // これ以上、探索する文字がない場合は、現時点の情報を返す
    if (!parent || !node || !node.char) {

      // extraChallenges が指定されている場合、もう１文字を試してみる
      const results: InternalResult<T>[] = [];
      if (depth > 0 && parent && extraChallenges && extraChallenges.length > 0) {
        for (const extraChar of extraChallenges) {
          if (!parent.children.has(extraChar)) {
            continue;
          }
          const child = parent.children.get(extraChar)!;
          const others = this.traverse({
            fuzzy,
            parent: child,
            node,
            partialMatches,
            extraChallenges: [], // 2回 extraChallenge は行わない
            depth: depth + 1,
          });
          if (!others) {
            continue;
          }
          others.forEach(other => results.push(other));
        }
      }

      if (!partialMatches && results.length > 0) {
        return results;
      }

      parent?.info?.forEach(info => {
        results.push({
          info,
          unmatched: node,
          depth,
        } as InternalResult<T>)
      });

      return results;
    }

    // searchChar が parent.children にある場合は、
    // そのまま探索する
    if (parent.children.has(node.char)) {
      const parent2 = parent.children.get(node.char);
      const others = this.traverse({
        fuzzy,
        parent: parent2,
        node: node.next,
        partialMatches,
        extraChallenges,
        depth: depth + 1,
      });

      const results: InternalResult<T>[] = [];
      others?.forEach(other => results.push(other));

      // 中間結果を含まない場合は、情報を返す
      if (!partialMatches) {
        return results;
      }

      // 中間結果を含む場合、または、
      // 子ノードで見つからなかったけど、それよりも親ノードで部分一致する場合、
      // その情報を返す。
      parent?.info?.forEach(info => {
        results.push({
          info,
          unmatched: node,
          depth,
          ambiguous: false,
        });
      });
      return results;
    }

    // fuzzyが来た場合、全ての可能性を探索する
    if (node.char === fuzzy) {
      const results: InternalResult<T>[] = [];
      for (const child of parent.children.values()) {
        const others = this.traverse({
          fuzzy,
          parent: child,
          node: node.next,
          partialMatches,
          extraChallenges: [], // fuzzy のときは extraChallengeをしない
          depth: depth + 1,
        });
        others?.forEach(other => {
          // extraChallengeをした結果
          // fuzzy が unmatched の最初に来るときは、fuzzy を取り除く
          if (other.unmatched?.char === fuzzy) {
            other.unmatched = other.unmatched.next!;
          }
          other.ambiguous = true;
          results.push(other);
        });
      }
    
      // 中間結果を含める場合は、現時点の情報を追加する
      if (partialMatches) {
        parent.info?.forEach(info => {
          results.push({
            info,
            unmatched: node,
            depth,
            ambiguous: false,
          });
        })
      }
      return results;
    }

    // 見つからなかったら、現在位置までの情報を返す
    const results: InternalResult<T>[] = [];
    parent?.info?.forEach(info => {
      results.push({
        info,
        unmatched: node,
        depth,
        ambiguous: false,
      });
    });

    // extraChallenges が指定されている場合、もう１文字を試してみる
    if (depth > 0 && parent && extraChallenges && extraChallenges.length > 0) {
      for (const extraChar of extraChallenges) {
        if (!parent.children.has(extraChar)) {
          continue;
        }

        const child = parent.children.get(extraChar)!;
        const others = this.traverse({
          fuzzy,
          parent: child,
          node,
          partialMatches,
          extraChallenges: [], // 2回目は行わない
          depth: depth + 1,
        });
        if (!others) {
          continue;
        }
        others.forEach(other => {
          // extraChallengeをした結果
          // fuzzy が unmatched の最初に来るときは、fuzzy を取り除く
          if (other.unmatched?.char === fuzzy) {
            other.unmatched = other.unmatched.next!;
          }
          other.ambiguous = true;
          results.push(other)
        });
      }
    }
    
    return results;
  }
}
