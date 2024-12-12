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
import { getPackageInfo } from '@domain/services/package/get-package-info';
import { SemaphoreManager } from '@domain/services/thread/semaphore-manager';
import stringify from 'json-stable-stringify';
import fs from 'node:fs';
import zlib from 'node:zlib';
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
  WriteTrieNode
} from './abrg-file-structure';
import { TrieTreeBuilderBase } from './trie-tree-builder-base';

export class FileTrieWriter extends TrieTreeBuilderBase {
  private header: AbrgDictHeader | undefined;

  private lastDataNodeOffset: number = 0;

  private readonly semaphore: SemaphoreManager;
  private readonly dataHashValueToOffsetMap: Map<bigint, number> = new Map();

  private constructor(fd: fs.promises.FileHandle, size: number = 0) {
    super(fd, size);
    const arrayBuffer = new SharedArrayBuffer(4);
    this.semaphore = new SemaphoreManager(arrayBuffer);
    this.debug = false;
  }

  private async writeHeader(header?: AbrgDictHeader) {
    const packageJsonMeta = await getPackageInfo();

    let offset = 0;

    // magicの書き込み
    const magicBuffer = Buffer.alloc(ABRG_FILE_MAGIC.size);
    ['a','b','r','g'].forEach((char: string, offset: number) => {
      magicBuffer.writeUInt8(char.charCodeAt(0), offset);
    });
    offset += magicBuffer.length;

    // ヘッダーサイズの書き込み
    const headerSizeBuffer = Buffer.alloc(ABRG_FILE_HEADER_SIZE.size);
    offset += headerSizeBuffer.length;

    // バージョン
    // 将来的に書きこんだversionによってロジックが変えられるようにするため書いておく
    const versionBuffer = Buffer.alloc(VERSION_BYTES.size);
    const [majorVersion, minorVersion]: number[] = packageJsonMeta.version.split('.').map(x => parseInt(x));
    versionBuffer.writeUInt8(majorVersion, 0);
    versionBuffer.writeUInt8(minorVersion, 1);
    offset += versionBuffer.length;

    // トライノードのオフセット値
    const trieNodeOffsetBuffer = Buffer.alloc(TRIE_NODE_ENTRY_POINT.size);
    if (header?.trieNodeOffset) {
      trieNodeOffsetBuffer.writeUInt32BE(header.trieNodeOffset);
    }
    offset += trieNodeOffsetBuffer.length;
    
    // データノードのオフセット値
    const dataNodeOffsetBuffer = Buffer.alloc(DATA_NODE_ENTRY_POINT.size);
    if (header?.dataNodeOffset) {
      dataNodeOffsetBuffer.writeUInt32BE(header.dataNodeOffset);
    }
    offset += dataNodeOffsetBuffer.length;

    // ヘッダーサイズが確定
    headerSizeBuffer.writeUInt16BE(offset);

    const finalBuffer = Buffer.concat([
      magicBuffer,
      headerSizeBuffer,
      versionBuffer,
      trieNodeOffsetBuffer,
      dataNodeOffsetBuffer,
    ]);

    // ファイルに書き込む
    await this.write(finalBuffer, 0);

    return {
      version: {
        major: majorVersion,
        minor: minorVersion,
      },
      trieNodeOffset: offset,
      dataNodeOffset: null,
      headerSize: offset,
    };
  }

  private async readAllDataNodes() {
    if (!this.header?.dataNodeOffset) {
      return;
    }
    
    // データノードを全て辿っていき、dataHashValueMap に格納していく
    let offset: number = this.header.dataNodeOffset;
    let hashValue: bigint;
    let nextOffset: number = 0;
    // データノードのヘッダを読み込むためのバッファ
    const dataNodeHead = Buffer.alloc(DATA_NODE_NEXT_OFFSET.size + DATA_NODE_SIZE_FIELD.size + DATA_NODE_HASH_VALUE.size);
    // データノードの連結リストが続く限り、読み取っていく
    while (offset > 0) {
      await this.copyTo(offset, dataNodeHead);
      nextOffset = dataNodeHead.readUInt32BE(DATA_NODE_NEXT_OFFSET.offset);
      hashValue = dataNodeHead.readBigUInt64BE(DATA_NODE_HASH_VALUE.offset);

      // ハッシュ値が衝突する可能性があるが、それほど多くはないはずなので、先頭のオフセット値だけをキープする
      if (!this.dataHashValueToOffsetMap.has(hashValue)) {
        this.dataHashValueToOffsetMap.set(hashValue, offset);
      }

      offset = nextOffset;
    }
  }

  static create = async (filePath: string) => {
    const fd = await fs.promises.open(filePath, 'w+');
    const stat = await fd.stat();
    const writer = new FileTrieWriter(fd, stat.size);

    let header: AbrgDictHeader | null = await writer.readHeader();
    if (header) {
      writer.header = header;

      // ファイルに書き込まれている全データノードを読み込み
      await writer.readAllDataNodes();

      return writer;
    }

    // ファイルヘッダーの作成
    header = await writer.writeHeader();

    // ルートノードの値(0)を書き込む
    const rootDataOffset = await writer.storeData({});
    writer.dataHashValueToOffsetMap.set(0n, rootDataOffset);
    
    // ルートノード(トライ木ノード)を書き込む
    const rootNode = await writer.writeTrieNode({
      trieNode: {
        name: '',
      },
      hashValueOffset: rootDataOffset,
    });

    // writerにheaderを持たせる
    header.trieNodeOffset = rootNode.offset!;
    header.dataNodeOffset = rootDataOffset;
    writer.header = header;

    // ファイルのヘッダー情報を更新する
    await writer.writeHeader(header);

    return writer;
  };

  private async writeSiblingOffsetFieldOnTrieNode({
    // ノード情報
    trieNode,
  } : {
    trieNode : WriteTrieNode;
  }) {
    if (!trieNode.offset) {
      console.error(`trieNode.offset is required`)
      throw `trieNode.offset is required`;
    }

    // 子ノードへのオフセット値
    const childNodeOffsetBuffer = Buffer.alloc(TRIE_NODE_SIBLING_OFFSET.size);
    childNodeOffsetBuffer.writeUInt32BE(trieNode.siblingOffset!);

    await this.write(childNodeOffsetBuffer, trieNode.offset + TRIE_NODE_SIBLING_OFFSET.offset);
  }

  private async writeChildOffsetFieldOnTrieNode({
    // ノード情報
    trieNode,
  } : {
    trieNode : WriteTrieNode;
  }) {
    if (!trieNode.offset) {
      console.error(`trieNode.offset is required`)
      throw `trieNode.offset is required`;
    }

    // 子ノードへのオフセット値
    const childNodeOffsetBuffer = Buffer.alloc(TRIE_NODE_CHILD_OFFSET.size);
    childNodeOffsetBuffer.writeUInt32BE(trieNode.childOffset!);

    await this.write(childNodeOffsetBuffer, trieNode.offset + TRIE_NODE_CHILD_OFFSET.offset);
  }  

  private async writeTrieNode({
    // ノード情報
    trieNode,

    // ノードに関連付けるハッシュ値を保存する領域へのオフセット値
    hashValueOffset,
  }: {
    trieNode : WriteTrieNode,
    hashValueOffset?: number
  }): Promise<ReadTrieNode> {
    // 同じオフセットの位置にデータが書き込まれていたらマージする
    const prevTrieNode = trieNode.offset && this.trieNodeMap.get(trieNode.offset) || trieNode;
    if (prevTrieNode) {
      if (!trieNode.siblingOffset) {
        trieNode.siblingOffset = prevTrieNode.siblingOffset;
      }
      if (!trieNode.childOffset) {
        trieNode.childOffset = prevTrieNode.childOffset;
      }
      if (!trieNode.hashValueList) {
        trieNode.hashValueList = prevTrieNode.hashValueList;
      }
      trieNode.name = prevTrieNode.name;
    }
    if (this.debug) {
      console.log(`         hashValueOffset : ${hashValueOffset} `);
      console.log(`            name: ${trieNode.name} `);
      console.log(`            siblingOffset: ${trieNode.siblingOffset} `);
      console.log(`            childOffset: ${trieNode.childOffset} `);
      console.log(`            hashValueList: ${JSON.stringify(trieNode.hashValueList)} `);
      console.log(`            offset: ${trieNode.offset} `);
    }

    let trieNodeSize = 0;
    const buffers: Buffer[] = [];

    // トライ木ノードのサイズ
    const trieNodeSizeBuffer = Buffer.alloc(TRIE_NODE_SIZE_FIELD.size);
    buffers.push(trieNodeSizeBuffer);
    trieNodeSize += trieNodeSizeBuffer.length;

    // 兄弟ノードへのオフセット値
    const siblingNodeOffsetBuffer = Buffer.alloc(TRIE_NODE_SIBLING_OFFSET.size);
    if (trieNode.siblingOffset) {
      siblingNodeOffsetBuffer.writeUInt32BE(trieNode.siblingOffset);
    }
    buffers.push(siblingNodeOffsetBuffer);
    trieNodeSize += siblingNodeOffsetBuffer.length;

    // 子ノードへのオフセット値
    const childNodeOffsetBuffer = Buffer.alloc(TRIE_NODE_CHILD_OFFSET.size);
    if (trieNode.childOffset) {
      childNodeOffsetBuffer.writeUInt32BE(trieNode.childOffset);
    }
    buffers.push(childNodeOffsetBuffer);
    trieNodeSize += childNodeOffsetBuffer.length;

    // ノードに関連付けるハッシュ値連結リストへのオフセット値(4バイト)
    const hashOffsetBuffer = Buffer.alloc(TRIE_NODE_HASH_LINKED_LIST_OFFSET.size);
    if (trieNode.hashValueList?.offset) {
      const storedHashValueOffset = await this.readUInt32BE(trieNode.hashValueList?.offset);
      hashOffsetBuffer.writeUInt32BE(storedHashValueOffset);
    }
    buffers.push(hashOffsetBuffer);
    trieNodeSize += hashOffsetBuffer.length;

    if (trieNode.name) {
      // 1文字以上
      const nameBuffer = Buffer.from(trieNode.name, 'utf8');
      buffers.push(nameBuffer);
      trieNodeSize += nameBuffer.length;
    }

    // ノードのサイズが確定
    trieNodeSizeBuffer.writeUInt8(trieNodeSize, 0);

    // ファイルバッファに書き込む
    const writeOffset = trieNode.offset || this.fileSize;
    const data = Buffer.concat(buffers);
    await this.write(data, writeOffset);
    trieNode.offset = writeOffset;

    let hashValueList: TrieHashListNode | undefined;
    if (hashValueOffset) {
      // このトライ木ノードに関連付けてあるハッシュ値のオフセットのリストに追加する
      hashValueList = await this.appendHashOffset({
        trieNode,
        hashValueOffset,
      });

      // hashValueList = this.createHashValueList({
      //   hashValueOffset: TRIE_NODE_HASH_LINKED_LIST_OFFSET.size,
      //   nodeBuffer: data,
      // });
    }
    const readTrieNode = {
      name: trieNode.name,
      offset: writeOffset,
      childOffset: trieNode.childOffset || 0,
      siblingOffset: trieNode.siblingOffset || 0,
      hashValueList,
      nodeSize: trieNodeSize,
    };

    this.trieNodeMap.set(writeOffset, readTrieNode);
    return readTrieNode;
  }

  // トライ木に関連付けられるハッシュ値を定義してある領域へのオフセット値の、連結リストの最後に追加する
  private async appendHashOffset({
    trieNode,
    hashValueOffset,
  }: {
    trieNode: WriteTrieNode;
    hashValueOffset: number;
  }) {
    if (!trieNode.offset) {
      console.error(`trieNode.offset is required`);
      throw `trieNode.offset is required`;
    }

    // 1つ前のハッシュ値のオフセット値が書かれているアドレス
    let parentHashOffsetNodeOffset: number = trieNode.offset + TRIE_NODE_HASH_LINKED_LIST_OFFSET.offset;
    // 次に移動するオフセット値
    let nextOffset: number = trieNode.hashValueList?.offset || 0;
    // メモリから読み込んだハッシュ値へのオフセット値
    let storedHashValueOffset: number = await this.readUInt32BE(parentHashOffsetNodeOffset);
    // copyTo()の戻り値の受取
    let bytesRead: number;
    // ハッシュ値のリストを読み取るためのバッファ
    // 次のハッシュ値リストのノードへのオフセット値(4バイト)+実際のデータを格納している領域へのオフセット値
    const hashLinkNodeBuffer = Buffer.alloc(
      HASH_LINK_NODE_NEXT_OFFSET.size +
      HASH_LINK_NODE_OFFSET_VALUE.size,
    );
    // 同じハッシュ値へのオフセット値を既に持っているかどうか 
    let hasSameHashValueOffset = false;

    // 先頭アンカー
    const headValueList: TrieHashListNode = {
      hashValueOffset: storedHashValueOffset,
      offset: parentHashOffsetNodeOffset,
      next: undefined,
    };
    // 末尾
    let tailValueList: TrieHashListNode = headValueList;

    // このトライ木ノードに同じハッシュ値へのオフセット値が関連付けられているかチェックする
    while (nextOffset) {
      if (this.debug) {
        console.log(`              (next)${nextOffset}`);
      }
      // if (this.trieHashListNodeMap.has(nextOffset)) {
      //   // キャッシュがあれば採用(基本的にあるはず)
      //   tailValueList.next = this.trieHashListNodeMap.get(nextOffset)!;
      //   nextOffset = tailValueList.next.offset || 0;
      // } else {
        // nextOffsetの位置のハッシュリンクを読み込む
        bytesRead = await this.copyTo(nextOffset, hashLinkNodeBuffer);
        if (bytesRead < hashLinkNodeBuffer.length) {
          console.error(`Can not read the hashLinkNode correctly.`)
          throw `Can not read the hashLinkNode correctly.`;
        }
        parentHashOffsetNodeOffset = nextOffset;
  
        // 次のハッシュオフセットノードへのオフセット値
        nextOffset = hashLinkNodeBuffer.readUInt32BE(HASH_LINK_NODE_NEXT_OFFSET.offset);
        // 保存されているハッシュ値へのオフセット値
        storedHashValueOffset = hashLinkNodeBuffer.readUInt32BE(HASH_LINK_NODE_OFFSET_VALUE.offset);

        // リストを構築していく
        tailValueList.next = {
          hashValueOffset: storedHashValueOffset,
          offset: parentHashOffsetNodeOffset,
          next: undefined,
        };
        this.trieHashListNodeMap.set(parentHashOffsetNodeOffset, tailValueList.next);
      // }
      // 既に同じハッシュ値へのオフセット値が保存されているか判定
      hasSameHashValueOffset = hasSameHashValueOffset || (storedHashValueOffset === hashValueOffset);

      tailValueList = tailValueList.next;
    }

    // 既に同じハッシュ値へのオフセット値が保存されている場合は終了
    if (hasSameHashValueOffset) {
      return headValueList.next;
    }
    
    // nextOffset = 0 が成立しているので、ファイルの末尾に追加
    hashLinkNodeBuffer.writeUInt32BE(0, HASH_LINK_NODE_NEXT_OFFSET.offset); // 次のhashLinkNodeへのオフセット値
    hashLinkNodeBuffer.writeUInt32BE(hashValueOffset, HASH_LINK_NODE_OFFSET_VALUE.offset); // 実際のデータが保存されている領域へのオフセット値
    const writeOffset = this.fileSize;
    await this.write(hashLinkNodeBuffer, writeOffset);

    // 1つ前のノードから関連付ける
    const onlyOffset = Buffer.alloc(HASH_LINK_NODE_OFFSET_VALUE.size);
    onlyOffset.writeUInt32BE(writeOffset);
    await this.write(onlyOffset, parentHashOffsetNodeOffset);
    if (this.debug) {
      console.log(`              (save)${writeOffset} at ${parentHashOffsetNodeOffset} (node: ${trieNode.offset})`);
    }

    // リストにも追加する
    tailValueList.next = {
      hashValueOffset,
      offset: writeOffset,
      next: undefined,
    }
    this.trieHashListNodeMap.set(writeOffset, tailValueList.next);
    if (this.debug) {
      console.log(`              (save)${JSON.stringify(headValueList)}`);
    }

    return headValueList;
  }

  private async storeData(data: any): Promise<number> {
    const dataStr = stringify(data);
    const dataBuffer = zlib.gzipSync(Buffer.from(dataStr), {
      level: 9,
    });
    const hashValue = this.bufferToBigIntHash(dataBuffer);

    // データノード先頭にある、次のデータノードへのオフセット値を読み込むためのバッファ
    const nextDataNodeOffsetBuffer = Buffer.alloc(DATA_NODE_ENTRY_POINT.size);

    let parentDataNodeOffset = 0;
    if (this.dataHashValueToOffsetMap.has(hashValue)) {
      // キャッシュがある場合、キーが衝突している可能性がある
      parentDataNodeOffset = this.dataHashValueToOffsetMap.get(hashValue)!;

      // 連結リストになって返ってくるので、各ノードの実データと保存したいデータを比較する
      let dataNode = await this.readDataNode(parentDataNodeOffset);
      while (dataNode) {
        // データを読み取って同じなら、parentDataNodeOffsetを返す
        if (dataNode?.data && dataBuffer.compare(dataNode.data) === 0) {
          return dataNode.offset;
        }
        parentDataNodeOffset = dataNode.offset;
        dataNode = dataNode.next;
      }

    } else {
      // キーが異なる場合は追記
      if (this.lastDataNodeOffset > 0) {
        parentDataNodeOffset = this.lastDataNodeOffset;
      } else {
        await this.copyTo(DATA_NODE_ENTRY_POINT.offset, nextDataNodeOffsetBuffer);
        parentDataNodeOffset = nextDataNodeOffsetBuffer.readUInt32BE(0);
      }
    }

    if (parentDataNodeOffset > 0) {
      // データの連結リストを辿っていき、最後に追加する
      let nextDataNodeOffset = 0;
      while (true) {
        await this.copyTo(parentDataNodeOffset, nextDataNodeOffsetBuffer);
        
        // 次のデータノードへのオフセット値
        nextDataNodeOffset = nextDataNodeOffsetBuffer.readUInt32BE(0);
        if (nextDataNodeOffset === 0) {
          break;
        }
        parentDataNodeOffset = nextDataNodeOffset;
      }
    } else {
      // 初めてデータを追加する場合は、ヘッダーのDATA_NODE_ENTRY_POINT
      parentDataNodeOffset = DATA_NODE_ENTRY_POINT.offset;
    }
    this.lastDataNodeOffset = Math.max(this.lastDataNodeOffset, parentDataNodeOffset);

    // ファイルの末尾をデータを書き込むオフセット値にする
    // (親ノードに記録する)
    const writeOffset = this.fileSize;
    nextDataNodeOffsetBuffer.writeUInt32BE(writeOffset, DATA_NODE_NEXT_OFFSET.offset);
    await this.write(nextDataNodeOffsetBuffer, parentDataNodeOffset);

    const buffers: Buffer[] = [];
    let dataNodeSize = 0;
    
    // 次のデータノードへのオフセット値を保存するためのプレイスホルダ
    nextDataNodeOffsetBuffer.fill(0);
    buffers.push(nextDataNodeOffsetBuffer);
    dataNodeSize += nextDataNodeOffsetBuffer.length;
    
    // データノードのサイズ
    const dataNodeSizeBuffer = Buffer.alloc(DATA_NODE_SIZE_FIELD.size);
    buffers.push(dataNodeSizeBuffer);
    dataNodeSize += dataNodeSizeBuffer.length;

    // データのハッシュ値(データに対するキー)
    const hashValueBuffer = Buffer.alloc(DATA_NODE_HASH_VALUE.size);
    hashValueBuffer.writeBigUInt64BE(hashValue);
    buffers.push(hashValueBuffer);
    dataNodeSize += hashValueBuffer.length;

    // 実データ
    buffers.push(dataBuffer);
    dataNodeSize += dataBuffer.length;

    // データノード全体のサイズが確定
    dataNodeSizeBuffer.writeUInt16BE(dataNodeSize);

    // ファイルに書き込む
    const dataNodeBuffer = Buffer.concat(buffers);
    await this.write(dataNodeBuffer, writeOffset);

    // 前回のデータノードと関連付ける
    // const offsetBuffer = Buffer.alloc(OFFSET_FIELD_SIZE);
    // offsetBuffer.writeUInt32BE(writeOffset);
    // await this.write(offsetBuffer, this.lastDataNodeOffset);

    // 次のためにオフセット値を持っておく
    this.lastDataNodeOffset = writeOffset;

    // ハッシュ値に対するオフセット値を記録
    if (!this.dataHashValueToOffsetMap.has(hashValue)) {
      this.dataHashValueToOffsetMap.set(hashValue, writeOffset);
    }

    return writeOffset;
  }

  async addNode({
    key,
    value,
  }: {
    key: string;
    value: any;
  }) {
    if (!this.header?.trieNodeOffset) {
      console.error(`Can not find the root node`)
      throw `Can not find the root node`;
    }

    // セマフォをロック
    await this.semaphore.enterAwait(0);

    // 新しいハッシュ値ならファイルに書き込む
    let hashValueOffset = await this.storeData(value);

    // ルートノードの読み取り
    const offset = this.header.trieNodeOffset;
    let rootNode: ReadTrieNode | null;
    if (this.trieNodeMap.has(offset)) {
      rootNode = this.trieNodeMap.get(offset)!;
    } else {
      rootNode = await this.readTrieNode(offset);
      this.trieNodeMap.set(offset, rootNode);
    }
    if (!rootNode) {
      console.error(`Can not find the root node`)
      throw `Can not find the root node`;
    }
    
    // keyの前方から既にある親ノードを探す
    type Task = {
      node: ReadTrieNode;
      idx: number;
      path: string;
    };
    const queue: Task[] = [{
      node: rootNode,
      idx: -1,
      path: '',
    }];

    let task: Task;
    let currentIdx: number = -1;
    
    while (queue.length > 0) {
      task = queue.shift()!;

      // 既に子ノードが見つかっているので、スキップ
      if (task.idx < currentIdx) {
        continue;
      }

      // マッチしないときは、兄弟ノードを探す
      if (task.idx > -1 && key[task.idx] !== task.node.name) {
        if (task.node.siblingOffset) {
          // 兄弟ノードを読み込む
          const siblingNode = await this.readTrieNode(task.node.siblingOffset);
          if (!siblingNode) {
            console.error(`Can not read the sibling node at ${task.node.siblingOffset}`)
            throw `Can not read the sibling node at ${task.node.siblingOffset}`;
          }
          queue.push({
            node: siblingNode,
            idx: task.idx,
            path: task.path,
          });
          continue;
        }
  
        // 全ての兄弟ノードをチェックしたが見つからない場合、兄弟ノードを追加する
        const siblingNode = await this.writeTrieNode({
          trieNode: {
            name: key[task.idx],
          },
          hashValueOffset: (task.idx === key.length - 1) ? hashValueOffset : undefined,
        });

        // 親ノードと作成した兄弟ノードを関連付ける
        task.node.siblingOffset = siblingNode.offset;
        await this.writeSiblingOffsetFieldOnTrieNode({
          trieNode: task.node,
        });
        if (this.debug) {
          console.log(`   [sibling] ${task.node.name} => ${siblingNode.name}`);
        }

        // 最後の文字だった場合は終了
        if (task.idx === key.length - 1) {
          break;
        }

        // 次の文字に進む
        task = {
          node: siblingNode,
          idx: task.idx,
          path: task.path + key[task.idx],
        };
      }
      // 文字がマッチした場合
      currentIdx = Math.max(currentIdx, task.idx + 1);

      // 全ての文字が既に登録されていて、末尾にたどり着いた場合
      if (task.idx === key.length - 1) {
        if (this.debug) {
          console.log(`   [write] ${task.node.name} with ${hashValueOffset}`);
        }
        // 現在のトライ木ノードに hashValueOffset を書き込んで終了
        await this.writeTrieNode({
          trieNode: task.node,
          hashValueOffset,
        });
        break;
      }

      let childNode: ReadTrieNode | null = null;
      if (task.node.childOffset) {
        // 子ノードがある場合は、子ノードに進む
        childNode = await this.readTrieNode(task.node.childOffset);
        if (!childNode) {
          console.error(`Cannot load the child node at ${task.node.childOffset}`)
          throw `Cannot load the child node at ${task.node.childOffset}`;
        }
      } else {
        // 子ノードがないので書き込む
        childNode = await this.writeTrieNode({
          trieNode: {
            name: key[task.idx + 1],
          },
        });

        // 親ノードのchildNodeOffsetに書き込む
        task.node.childOffset = childNode.offset;
        await this.writeChildOffsetFieldOnTrieNode({
          trieNode: task.node,
        })
      }
      if (this.debug) {
        console.log(`   [child] ${task.node.name} => ${childNode.name}`);
      }
      queue.push({
        node: childNode,
        idx: task.idx + 1,
        path: task.path + (task.idx > -1 ? key[task.idx] : ''),
      });
    }

    // セマフォのロックを解除
    this.semaphore.leave(0);
  }

  private bufferToBigIntHash(data: Buffer): bigint {
    const FNV_OFFSET_BASIS = BigInt("0xcbf29ce484222325"); // 64ビット FNV offset basis
    const FNV_PRIME = BigInt("0x100000001b3");           // 64ビット FNV prime

    let hash = FNV_OFFSET_BASIS;
    for (let i = 0; i < data.length; i++) {
        hash ^= BigInt(data.at(i)!);               // XOR
        hash = (hash * FNV_PRIME) & BigInt("0xffffffffffffffff"); // 64ビットの範囲内に収める
    }
    return hash;
  }
}
