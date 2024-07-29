import { CharNode } from "./char-node";

export class TrieFinderResult<T> {
  public readonly info: T | undefined;
  public readonly unmatched: CharNode;
  public readonly depth: number;

  constructor(params: {
    info: T | undefined;
    unmatched: CharNode;
    depth: number;
  }) {
    this.info = params.info;
    this.unmatched = params.unmatched;
    this.depth = params.depth;
    Object.freeze(this);
  }
}

type InternalResult<T> = {
  info: T | undefined;
  unmatched: CharNode;
  depth: number;
}

export class TrieNode<T> {
  info: T | undefined;
  children = new Map<string, TrieNode<T>>();
}

export class TrieAddressFinder<T> {
  private readonly root = new TrieNode<T[]>();
  private readonly fuzzy: string | undefined;

  constructor({
    fuzzy,
  }: {
    fuzzy: string | undefined;
  }) {
    this.fuzzy = fuzzy;
  }

  static createFromMap<T>({
    fuzzy,
    map,
  }: {
    fuzzy?: string;
    map: Map<string | number, T>;
  }) {
    const trie = new TrieAddressFinder<T>({
      fuzzy,
    });
    for (const [key, value] of map.entries()) {
      trie.append({
        key,
        value,
      });
    }
    return trie;
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
        const trie = parent.children.get(head.char!) || new TrieNode<T[]>();
        parent.children.set(head.char!, trie);
        parent = trie;
        head = head.next;
      }
    } else {
      for (const char of key.toString()) {
        const trie = parent.children.get(char) || new TrieNode<T[]>();
        parent.children.set(char, trie);
        parent = trie;
      }
    }
    parent.info = parent.info || [];
    parent.info.push(value);
  }

  find({ 
    target,

    // trueのとき、中間でマッチした結果も含めて返す
    partialMatches,

    // マッチしなかったときに、もう1文字を試してみる
    extraChallenges,
   }: {
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
    });

    return results?.map(result => {
      return new TrieFinderResult<T>({
        info: result.info,
        unmatched: result.unmatched,
        depth: result.depth,
      });
    });
  }

  private traverse({
    parent,
    node,
    partialMatches,
    extraChallenges,
  }: {
    parent: TrieNode<T[]> | undefined;
    node: CharNode | undefined;
    partialMatches: boolean;
    extraChallenges?: string[];
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
      });
    }

    // これ以上、探索する文字がない場合は、現時点の情報を返す
    if (!parent || !node || !node.char) {

      // extraChallenges が指定されている場合、もう１文字を試してみる
      const results: InternalResult<T>[] = [];
      if (parent && extraChallenges && extraChallenges.length > 0) {
        for (const extraChar of extraChallenges) {
          if (!parent.children.has(extraChar)) {
            continue;
          }
          const child = parent.children.get(extraChar)!;
          const others = this.traverse({
            parent: child,
            node,
            partialMatches,
            extraChallenges: [], // 2回 extraChallenge は行わない
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
          depth: 0,
        } as InternalResult<T>)
      });

      return results;
    }

    // searchChar が parent.children にある場合は、
    // そのまま探索する
    if (parent.children.has(node.char)) {
      const parent2 = parent.children.get(node.char);
      const others = this.traverse({
        parent: parent2,
        node: node.next,
        partialMatches,
        extraChallenges,
      });

      const results: InternalResult<T>[] = [];
      if (others) {
        others?.forEach(other => {
          other.depth++;
          results.push(other);
        });
      }
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
          depth: 0,
        });
      });
      return results;
    }

    // fuzzyが来た場合、全ての可能性を探索する
    if (node.char === this.fuzzy) {
      const results: InternalResult<T>[] = [];
      for (const child of parent.children.values()) {
        const others = this.traverse({
          parent: child,
          node: node.next,
          partialMatches,
          extraChallenges,
        });
        others?.forEach(other => results.push(other));
      }
    
      // 中間結果を含める場合は、現時点の情報を追加する
      if (partialMatches) {
        parent.info?.forEach(info => {
          results.push({
            info,
            unmatched: node,
            depth: 0,
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
        depth: 0,
      });
    });

    // extraChallenges が指定されている場合、もう１文字を試してみる
    if (parent && extraChallenges && extraChallenges.length > 0) {
      for (const extraChar of extraChallenges) {
        if (!parent.children.has(extraChar)) {
          continue;
        }

        const child = parent.children.get(extraChar)!;
        const others = this.traverse({
          parent: child,
          node,
          partialMatches,
          extraChallenges: [], // 2回目は行わない
        });
        if (!others) {
          continue;
        }
        others.forEach(other => results.push(other));
      }
    }
    
    return results;
  }
}
