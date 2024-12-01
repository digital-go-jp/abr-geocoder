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
import { DEFAULT_FUZZY_CHAR } from '@config/constant-values';
import {
  ABRG_FILE_HEADER_SIZE,
  ABRG_FILE_MAGIC,
  AbrgDictHeader,
  DATA_NODE_ENTRY_POINT,
  DATA_NODE_HASH_VALUE,
  DATA_NODE_NEXT_OFFSET,
  DATA_NODE_SIZE_FIELD,
  HASH_LINK_NODE_NEXT_OFFSET,
  HASH_LINK_NODE_OFFSET_VALUE,
  ReadTrieNode,
  TRIE_NODE_CHILD_OFFSET,
  TRIE_NODE_ENTRY_POINT,
  TRIE_NODE_HASH_LINKED_LIST_OFFSET,
  TRIE_NODE_SIBLING_OFFSET,
  TRIE_NODE_SIZE_FIELD,
  TrieHashListNode,
  VERSION_BYTES,
} from './abrg-file-structure';
import { CharNode } from './char-node';
import { TrieFinderResult } from './common';

export type TraverseQuery = {
  next: TraverseQuery | undefined;
  target: CharNode | undefined;
  matchedCnt: number;
  ambiguousCnt: number;
  offset?: number;
  hashValueList?: TrieHashListNode | undefined;
  partialMatches?: TraverseQuery[];
  path: string;
  allowExtraChallenge?: boolean;
};

class FileTrieResults {
  private readonly holder: Map<number, TraverseQuery> = new Map();

  add(value: TraverseQuery) {
    if (!value.hashValueList) {
      throw `value.hashValueList must not be a zero`;
    }
    // 過去のマッチした結果よりも良い結果なら保存する
    let hashOffset: number;
    let head: TrieHashListNode | undefined = value.hashValueList;
    let before: TraverseQuery | undefined;
    while (head) {
      hashOffset = head.hashValueOffset;
      before = this.holder.get(hashOffset);
      if (!before || before.matchedCnt - before.ambiguousCnt < value.matchedCnt - value.ambiguousCnt) {
        this.holder.set(hashOffset, {
          target: value.target,
          matchedCnt: value.matchedCnt,
          ambiguousCnt: value.ambiguousCnt,
          offset: value.offset,
          hashValueList: {
            hashValueOffset: hashOffset,
            offset: value.offset!,
          },
          path: value.path,
          next: undefined,
        });
      }
      head = head.next;
    }
  }

  values() {
    return this.holder.values();
  }
}

export class TrieAddressFinder2<T> {
  // ヘッダー
  private readonly header: AbrgDictHeader;

  constructor(private readonly buffer: Buffer) {
    this.header = this.readHeader();

    // console.log(`headerSize: ${this.header.headerSize} bytes`);
    // console.log(`version: ${this.header.version.major}.${this.header.version.minor}`);
    // console.log(`trieNodeOffset: ${this.header.trieNodeOffset}`);
    // console.log(`dataOffset: ${this.header.dataNodeOffset}`);
    // console.log("");
  }

  private readHeader() {
    let offset = 0;

    // ファイルマジックの確認
    const magic = this.buffer.toString('utf8', offset, ABRG_FILE_MAGIC.size);
    if (magic !== 'abrg') {
      throw new Error(`Invalid file format: ${magic}`);
    }
    offset += ABRG_FILE_MAGIC.size;

    // ヘッダーサイズを取得
    const headerSize = this.buffer.readUInt16BE(ABRG_FILE_HEADER_SIZE.offset);
    offset += ABRG_FILE_HEADER_SIZE.size;

    // 書き込んだバージョンを確認
    // (将来的にバージョンの互換性をチェックするために使用する)
    const majorVersion = this.buffer.readUInt8(VERSION_BYTES.offset);
    const minorVersion = this.buffer.readUInt8(VERSION_BYTES.offset + 1);
    offset += VERSION_BYTES.size;

    // トライ木のオフセット値を取得
    const trieNodeOffset = this.buffer.readUInt32BE(TRIE_NODE_ENTRY_POINT.offset);
    offset += TRIE_NODE_ENTRY_POINT.size;

    // データノードへのオフセット値
    const dataNodeOffset = this.buffer.readUInt32BE(DATA_NODE_ENTRY_POINT.offset);
    offset += DATA_NODE_ENTRY_POINT.size;

    return {
      version: {
        major: majorVersion,
        minor: minorVersion,
      },
      trieNodeOffset,
      dataNodeOffset,
      headerSize,
    };
  }


  // ノード情報を読み込む
  private readTrieNode(nodeOffset: number): ReadTrieNode {
    let offset = 0;

    // ノードサイズ
    const nodeSize = this.buffer.readUInt8(nodeOffset + TRIE_NODE_SIZE_FIELD.offset);
    offset += TRIE_NODE_SIZE_FIELD.size;

    // 兄弟ノードへのオフセット値
    const siblingOffset = this.buffer.readUInt32BE(nodeOffset + TRIE_NODE_SIBLING_OFFSET.offset);
    offset += TRIE_NODE_SIBLING_OFFSET.size;

    // 子ノードへのオフセット値
    const childOffset = this.buffer.readUInt32BE(nodeOffset + TRIE_NODE_CHILD_OFFSET.offset);
    offset += TRIE_NODE_CHILD_OFFSET.size;


    // データノードへのオフセット値の連結リスト
    const headValueList: TrieHashListNode = {
      offset: 0,
      hashValueOffset: 0,
      next: undefined,
    };
    let tailHashValueList: TrieHashListNode = headValueList;
    let storedHashValueOffset: number = 0;
    let currentOffset = this.buffer.readUInt32BE(nodeOffset + TRIE_NODE_HASH_LINKED_LIST_OFFSET.offset);
    let nextOffset: number = 0;
    while (currentOffset) {
      // 保存されているハッシュ値へのオフセット値
      storedHashValueOffset = this.buffer.readUInt32BE(HASH_LINK_NODE_OFFSET_VALUE.offset + currentOffset);
      // 次のハッシュオフセットノードへのオフセット値
      nextOffset = this.buffer.readUInt32BE(HASH_LINK_NODE_NEXT_OFFSET.offset + currentOffset);
      
      tailHashValueList.next = {
        offset: currentOffset,
        hashValueOffset: storedHashValueOffset,
        next: undefined,
      };
      tailHashValueList = tailHashValueList.next;
      currentOffset = nextOffset;
    }
    offset += TRIE_NODE_HASH_LINKED_LIST_OFFSET.size;

    // ノード名
    let name = '';
    if (offset < nodeSize) {
      const start = offset + nodeOffset;
      const end = start + (nodeSize - offset);
      name = this.buffer.toString('utf8', start, end);
      offset += nodeSize - offset;
    }

    return {
      name,
      nodeSize,
      offset: nodeOffset,
      siblingOffset,
      childOffset,
      hashValueList: headValueList.next,
    };
  }

  find({ 
    // 検索対象の文字列
    target,

    // ワイルドカードマッチの1文字
    fuzzy,

    // trueのとき、中間でマッチした結果も含めて返す
    partialMatches = false,

    // マッチしなかったときに、もう1文字を試してみる
    extraChallenges = [],
  }: {
    fuzzy?: string | undefined;
    target: CharNode | undefined;
    partialMatches?: boolean;
    extraChallenges?: string[];
  }): TrieFinderResult<T>[] {
    if (!target) {
      return [];
    }

    const leafNodes = this.traverseToLeaf({
      target,
      partialMatches,
      extraChallenges,
      fuzzy,
    });

    if (!leafNodes || leafNodes.length == 0) {
      return [];
    }
    const results: TrieFinderResult<T>[] = [];
    leafNodes.forEach(node => {
      if (!node.hashValueList) {
        return;
      }
      let dataNodeHead: TrieHashListNode | undefined = node.hashValueList;
      while (dataNodeHead) {
        const dataNode = this.readDataNode(dataNodeHead.hashValueOffset);
        results.push({
          info: dataNode.data,
          unmatched: node.target,
          depth: node.matchedCnt,
          ambiguousCnt: node.ambiguousCnt,
        });
        dataNodeHead = dataNodeHead.next;
      }
      
      // const originalData = convertToOriginalFields(data, reverseFieldMapping);
      // console.log({
      //   ...originalData,
      //   node,
      // });
    });
    return results;
  }
  private traverseToLeaf({
    target,
    partialMatches = false,
    extraChallenges,
    fuzzy,
  }: {
    target: CharNode;
    partialMatches: boolean;
    extraChallenges: string[];
    fuzzy: string | undefined;
  }) {
    if (!this.header.dataNodeOffset) {
      return [];
    }

    // ルートノードは空文字なので、それにヒットさせるためのDummyHead
    const dummyHead = new CharNode({
      originalChar: '',
      char: '',
    });
    dummyHead!.next = target;

    // 結果を保存するためのFileTrieResults
    const results = new FileTrieResults();

    // 探索キュー
    let head: TraverseQuery | undefined = {
      // 正確にマッチした文字数 (最初が空文字からマッチするので-1)
      matchedCnt: -1,

      // ?やextraChallengeでマッチした文字数
      ambiguousCnt: 0,

      // 検索する文字列
      target: dummyHead,

      // ファイルヘッダーの直後から探索を始める
      offset: this.header.trieNodeOffset,

      // 途中マッチした結果をキープしておく
      partialMatches: [],

      // マッチした文字のパス（デバッグ用）
      path: "",

      // extraChallengeをするか（一度したら、二回目はない)
      allowExtraChallenge: extraChallenges.length > 0,

      next: undefined,
    };

    // 連結配列の末尾
    let tail = head;

    // キューが空になるまで探索を行う
    let nextTask: TraverseQuery | undefined;
    while (head) {
      if (!head.offset) {
        const taskNext: TraverseQuery | undefined = head.next;
        head.next = undefined;
        head = taskNext;
        continue;
      }
      
      let target: CharNode | undefined = head.target;
      let ambiguousCnt: number = head.ambiguousCnt;
      let matchedCnt: number = head.matchedCnt;
      let path: string = head.path;
      const allowExtraChallenge: boolean | undefined = head.allowExtraChallenge;
      let node: ReadTrieNode;
      let offset: number | undefined = head.offset;
      const matches: TraverseQuery[] = head.partialMatches || [];
      while (head && target && offset) {
        // 現在のノード（currentOffset）の情報を読取る
        node = this.readTrieNode(offset);
        
        if (target?.char !== fuzzy && target?.char !== node.name) {
          if (node.siblingOffset) {
            // 次の兄弟ノードをチェックする
            offset = node.siblingOffset;
            continue;
          }
          // allowExtraChallengeがある場合は、その文字にマッチするものがあればキューに追加する
          if (allowExtraChallenge) {
            for (const extraWord of extraChallenges) {
              // 1文字目がマッチしない extraChallengeは行わない
              if (extraWord[0] !== node.name) {
                continue;
              }

              // extraWordの後ろにtargetをつなげる
              const extraNode = CharNode.create(extraWord);
              let extraTail = extraNode;
              while (extraTail?.next) {
                extraTail = extraTail!.next;
              }
              extraTail!.next = target.clone();

              // extraWord + target で検索を行うタスクを追加する
              const challenge = {
                ambiguousCnt: ambiguousCnt + extraWord.length,
                matchedCnt,
                target: extraNode,
                offset,
                partialMatches: Array.from(matches),
                path,
                allowExtraChallenge: false,
                next: undefined,
              };
              tail.next = challenge;
              tail = tail.next;
            }
          }
          break;
        }

        // ワイルドカードだった場合はマッチしなかった場合と、マッチした場合の2つに分岐する
        if (target?.char === DEFAULT_FUZZY_CHAR && node.siblingOffset) {
          // 兄弟ノードを追加する
          const moveToSiblingNode = {
            ambiguousCnt,
            matchedCnt,
            target: target.clone(),
            offset: node.siblingOffset,
            partialMatches: Array.from(matches),
            path,
            allowExtraChallenge,
            next: undefined,
          };
          tail.next = moveToSiblingNode;
          tail = tail.next;
          ambiguousCnt++;
        }
        path += target.char;

        // マッチした文字数のインクリメント
        matchedCnt++;

        // ターゲットノードに到達
        if (!target.next || !node.childOffset) {
          if (!node.hashValueList) {
            break;
          }

          // 保存する
          results.add({
            matchedCnt,
            ambiguousCnt: ambiguousCnt,
            hashValueList: node.hashValueList,
            target: target.next?.moveToNext(),
            offset,
            path,
            next: undefined,
          });
          if (partialMatches && matches?.length) {
            matches.forEach(match => results.add(match));
          }
          break;
        }

        // 途中結果も保存する
        if (node.hashValueList && matchedCnt > 0) {
          matches.push({
            matchedCnt,
            ambiguousCnt: ambiguousCnt,
            hashValueList: node.hashValueList,
            target: target.next.moveToNext(),
            offset,
            path,
            next: undefined,
          });
        }
        
        // 文字ポインターを移動させる
        target = target.next.moveToNext();

        offset = node.childOffset;
      }

      // リーフには到達しないが部分的にマッチした場合は結果に含める
      if (partialMatches && target && matches.length > 0) {
        matches.forEach(match => results.add(match));
      }
      
      // 前ノードとの関係を分離しておく
      nextTask = head.next;
      head.next = undefined;
      head = nextTask;
    }
    return Array.from(results.values()).filter(x => x.hashValueList && x.path);
  }

  readDataNode(hashValueOffset: number) {
    let offset = hashValueOffset;
    const nextDataNodeOffset = this.buffer.readUInt32BE(hashValueOffset);
    offset += DATA_NODE_NEXT_OFFSET.size;

    let nodeSize = this.buffer.readUint16BE(offset);
    offset += DATA_NODE_SIZE_FIELD.size;
    nodeSize -= DATA_NODE_NEXT_OFFSET.offset;
    nodeSize -= DATA_NODE_SIZE_FIELD.offset;

    const hashValue = this.buffer.readUInt32BE(offset);
    offset += DATA_NODE_HASH_VALUE.size;
    nodeSize -= DATA_NODE_HASH_VALUE.offset;

    let data = undefined;
    if (nodeSize > 0) {
      const dataStr = this.buffer.toString('utf8', offset, nodeSize + offset);
      data = JSON.parse(dataStr);
    }
     
    return {
      data,
      nodeSize,
      hashValue,
      offset: hashValueOffset,
      nextDataNodeOffset,
    };
  }
}

// ファイル読み込みと探索実行
// fs.readFile(`test-with-paging.bin`, (err, data) => {
//   if (err) throw err;

//   const finder = new TrieAddressFinder2(data);
//   [
//     "中央区",
//     "静岡県沼津市",
//     "静岡県沼津市岡一色",
//     "静岡県沼津市岡一色485-6",
//     "静岡県沼津市岡一色485-3",
//     "静岡県沼津市岡宮",
//     "静岡県沼津市岡宮421",
//     "静岡県三島市加茂川町",
//     "静岡県三島市加茂川町123",
//     "東京都千代田区紀尾井町1-3",
//     "東京都千代田区紀尾井町1",
//     "東京都調布市国領町3-8-15",
//     "東京都調布市国領町",
//   ].forEach(addr => {
//     const results = finder.find({
//       target: CharNode.create(addr),
//       partialMatches: false,
//     });
//     console.log(results);
//   })
// });
