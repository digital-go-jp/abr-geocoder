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
import stringify from 'json-stable-stringify';
import fs from 'node:fs';
import {
  ABRG_FILE_HEADER_SIZE,
  ABRG_FILE_MAGIC,
  AbrgDictHeader,
  DATA_NODE_ENTRY_POINT,
  DATA_NODE_HASH_VALUE,
  DATA_NODE_NEXT_OFFSET,
  DATA_NODE_SIZE_FIELD,
  OFFSET_FIELD_SIZE,
  TRIE_NODE_CHILD_OFFSET,
  TRIE_NODE_ENTRY_POINT,
  TRIE_NODE_HASH_LINKED_LIST_OFFSET,
  TRIE_NODE_SIBLING_OFFSET,
  TRIE_NODE_SIZE_FIELD,
  VERSION_BYTES,
  WriteTrieNode,
  HASH_LINK_NODE_OFFSET_VALUE,
  HASH_LINK_NODE_NEXT_OFFSET,
  ReadTrieNode,
  TrieHashListNode,
} from './abrg-file-structure';
import { SemaphoreManager } from '@domain/services/thread/semaphore-manager';
import { ExpandableBuffer } from './expandable-buffer';

export class FileTrieWriter {
  private readonly dataHashValueMap: Map<number, number> = new Map();
  private header: AbrgDictHeader | undefined;

  private lastDataNodeOffset: number = 0;

  private readonly semaphore: SemaphoreManager;

  private constructor(
    private readonly filePath: string,
    private fileBuffer: ExpandableBuffer,
  ) {
    const arrayBuffer = new ArrayBuffer(4);
    this.semaphore = new SemaphoreManager(arrayBuffer);
  }

  private readHeader(): AbrgDictHeader | null {

    // ファイル先頭6バイトを読み込む
    const first6BytesBuffer = this.fileBuffer.read(0, ABRG_FILE_MAGIC.size + ABRG_FILE_HEADER_SIZE.size);

    // ファイルマジックの確認 (先頭4バイト)
    const name = first6BytesBuffer.toString('ascii', 0, ABRG_FILE_MAGIC.size);
    if (name !== 'abrg') {
      return null;
    }

    // ヘッダーサイズ
    const headerSize = first6BytesBuffer.readUint16BE(ABRG_FILE_HEADER_SIZE.offset);

    // ヘッダー全体の読み込み
    const headerBuffer = this.fileBuffer.read(0, headerSize);
    
    // バージョン番号の読み取り
    // version 2.2でない場合はサポートしていない
    // (将来的に書きこんだversionによってロジックが変わる可能性がある)
    const majorVersion = headerBuffer.readUInt8(VERSION_BYTES.offset);
    const minorVersion = headerBuffer.readUInt8(VERSION_BYTES.offset + 1);
    if (majorVersion !== 2 || minorVersion < 2) {
      return null;
    }

    // トライ木ノードへのオフセット値
    const trieNodeOffset = headerBuffer.readUInt32BE(TRIE_NODE_ENTRY_POINT.offset);

    // データノードへのオフセット値
    const dataNodeOffset = headerBuffer.readUInt32BE(DATA_NODE_ENTRY_POINT.offset);

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
    this.writeToFileBuffer(finalBuffer, 0);

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

  private readAllDataNodes() {
    if (!this.header?.dataNodeOffset) {
      return;
    }
    
    let offset: number = this.header.dataNodeOffset;
    let hashValue: number = 0;
    // let dataNodeSize: number = 0;
    let nextOffset: number = 0;
    const dataNodeHead = Buffer.alloc(DATA_NODE_NEXT_OFFSET.size + DATA_NODE_SIZE_FIELD.size + DATA_NODE_HASH_VALUE.size);
    while (offset > 0) {
      this.fileBuffer.copyTo(offset, dataNodeHead);
      nextOffset = dataNodeHead.readUInt32BE(DATA_NODE_NEXT_OFFSET.offset);
      // dataNodeSize = dataNodeHead.readUInt16BE(DATA_NODE_SIZE_FIELD.offset);
      hashValue = dataNodeHead.readUInt32BE(DATA_NODE_HASH_VALUE.offset);

      // const dataBuffer = Buffer.alloc(dataNodeSize - dataNodeHead.length);
      // this.fileBuffer.copyTo(offset + DATA_NODE_HASH_VALUE.offset + DATA_NODE_HASH_VALUE.size, dataBuffer);
      this.dataHashValueMap.set(hashValue, offset);

      offset = nextOffset;
    }
  }


  static openFile = async (filePath: string) => {
    let data = null;
    if (fs.existsSync(filePath)) {
      data = await fs.promises.readFile(filePath);
    } else {
      data = Buffer.alloc(ABRG_FILE_HEADER_SIZE.size);
    }
    const writer = new FileTrieWriter(filePath, new ExpandableBuffer(data));

    let header: AbrgDictHeader | null = writer.readHeader();
    if (header) {
      writer.header = header;

      // ファイルに書き込まれている全データノードを読み込み
      writer.readAllDataNodes();

      return writer;
    }

    // ファイルヘッダーの作成
    header = await writer.writeHeader();

    // ルートノードの値(0)を書き込む
    const rootDataOffset = writer.storeHashValueAndData({
      hashValue: 0,
      data: '',
    });
    writer.dataHashValueMap.set(0, rootDataOffset);
    
    // ルートノード(トライ木ノード)を書き込む
    const rootNodeOffset = writer.writeTrieNode({
      trieNode: {
        name: '',
      },
      hashValueOffset: rootDataOffset,
    });

    // writerにheaderを持たせる
    header.trieNodeOffset = rootNodeOffset;
    header.dataNodeOffset = rootDataOffset;
    writer.header = header;

    // ファイルのヘッダー情報を更新する
    await writer.writeHeader(header);

    return writer;
  };

  private readTrieNode(nodeOffset: number): ReadTrieNode | null {

    // ノードサイズを読み取る(1)
    const nodeSizeBuffer = this.fileBuffer.read(nodeOffset, TRIE_NODE_SIZE_FIELD.size);
    const nodeSize = nodeSizeBuffer.readUInt8();

    // ノード全体を読み取る
    const nodeBuffer = this.fileBuffer.read(nodeOffset, nodeSize);
    
    // nodeBufferを読み取るためのオフセット値
    let offset = TRIE_NODE_SIZE_FIELD.offset + TRIE_NODE_SIZE_FIELD.size;

    // 兄弟ノードへのオフセット値
    const siblingOffset = nodeBuffer.readUInt32BE(TRIE_NODE_SIBLING_OFFSET.offset);
    offset += TRIE_NODE_SIBLING_OFFSET.size;

    // 子ノードへのオフセット値
    const childOffset = nodeBuffer.readUInt32BE(TRIE_NODE_CHILD_OFFSET.offset);
    offset += TRIE_NODE_CHILD_OFFSET.size;

    // データノードへのオフセット値の連結リスト
    const headValueList: TrieHashListNode = {
      hashValueOffset: 0,
      offset: 0,
      next: undefined,
    };
    let tailHashValueList: TrieHashListNode = headValueList;
    let storedHashValueOffset: number = 0;
    let currentOffset = nodeBuffer.readUInt32BE(TRIE_NODE_HASH_LINKED_LIST_OFFSET.offset);
    let nextOffset: number = 0;
    const hashLinkNodeBuffer = Buffer.alloc(
      HASH_LINK_NODE_NEXT_OFFSET.size +
      HASH_LINK_NODE_OFFSET_VALUE.size,
    );
    let bytesRead: number = 0;
    while (currentOffset) {
      bytesRead = this.fileBuffer.copyTo(currentOffset, hashLinkNodeBuffer);
      if (bytesRead < hashLinkNodeBuffer.length) {
        break;
      }

      // 次のハッシュオフセットノードへのオフセット値
      nextOffset = hashLinkNodeBuffer.readUInt32BE(HASH_LINK_NODE_NEXT_OFFSET.offset);
      // 保存されているハッシュ値へのオフセット値
      storedHashValueOffset = hashLinkNodeBuffer.readUInt32BE(HASH_LINK_NODE_OFFSET_VALUE.offset);
      
      tailHashValueList.next = {
        hashValueOffset: storedHashValueOffset,
        offset: currentOffset,
        next: undefined,
      };
      tailHashValueList = tailHashValueList.next;
      currentOffset = nextOffset;
    }
    offset += TRIE_NODE_HASH_LINKED_LIST_OFFSET.size;

    // ノード名
    let name = '';
    if (offset < nodeSize) {
      name = nodeBuffer.toString('utf8', offset, nodeSize);
      offset += nodeSize - offset;
    }

    return {
      name,
      offset: nodeOffset,
      hashValueList: headValueList.next,
      siblingOffset: siblingOffset === 0 ? undefined : siblingOffset,
      childOffset: childOffset === 0 ? undefined : childOffset,
    };
  }
  

  private writeTrieNode({
    // ノード情報
    trieNode,

    // ノードに関連付けるハッシュ値を保存する領域へのオフセット値
    hashValueOffset,
  }: {
    trieNode : WriteTrieNode,
    hashValueOffset?: number
  }): number {

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
      hashOffsetBuffer.writeUInt32BE(trieNode.hashValueList.offset);
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
    const writeOffset = trieNode.offset || this.fileBuffer.size();
    const data = Buffer.concat(buffers);
    this.writeToFileBuffer(data, writeOffset);
    trieNode.offset = writeOffset;

    if (hashValueOffset) {
      this.appendHashOffset({
        trieNode,
        hashValueOffset,
      });
      // if (!trieNode.valueLinkOffset) {
      //   hashOffsetBuffer.writeUInt32BE(valueLinkOffset);
      //   await this.writeToFile(hashOffsetBuffer, writeOffset + TRIE_NODE_HASH_LINKED_LIST_OFFSET.offset);
      // }
    }
    return writeOffset;
  }

  // トライ木に関連付けられるハッシュ値を定義してある領域へのオフセット値の、連結リストの最後に追加する
  private appendHashOffset({
    trieNode,
    hashValueOffset,
  }: {
    trieNode: WriteTrieNode;
    hashValueOffset: number;
  }) {
    if (!trieNode.offset) {
      throw `trieNode.offset is required`;
    }

    let parentHashOffsetNodeOffset: number = trieNode.hashValueList?.offset || trieNode.offset + TRIE_NODE_HASH_LINKED_LIST_OFFSET.offset;
    let nextOffset: number = trieNode.hashValueList?.offset || 0;
    let storedHashValueOffset: number = 0;
    let bytesRead: number;
    const hashLinkNodeBuffer = Buffer.alloc(
      HASH_LINK_NODE_NEXT_OFFSET.size +
      HASH_LINK_NODE_OFFSET_VALUE.size,
    );
    while (nextOffset && storedHashValueOffset !== hashValueOffset) {
      bytesRead = this.fileBuffer.copyTo(nextOffset, hashLinkNodeBuffer);
      if (bytesRead < hashLinkNodeBuffer.length) {
        break;
      }
      parentHashOffsetNodeOffset = nextOffset;

      // 次のハッシュオフセットノードへのオフセット値
      nextOffset = hashLinkNodeBuffer.readUInt32BE(HASH_LINK_NODE_NEXT_OFFSET.offset);
      // 保存されているハッシュ値へのオフセット値
      storedHashValueOffset = hashLinkNodeBuffer.readUInt32BE(HASH_LINK_NODE_OFFSET_VALUE.offset);
    }

    // 既に同じハッシュ値へのオフセット値が保存されている場合は終了
    if (storedHashValueOffset === hashValueOffset) {
      return;
    }
    
    // nextOffset = 0 が成立しているので、ファイルの末尾に追加
    hashLinkNodeBuffer.writeUInt32BE(0, HASH_LINK_NODE_NEXT_OFFSET.offset);
    hashLinkNodeBuffer.writeUInt32BE(hashValueOffset, HASH_LINK_NODE_OFFSET_VALUE.offset);
    const writeOffset = this.fileBuffer.size();
    this.writeToFileBuffer(hashLinkNodeBuffer, writeOffset);

    // 前のノードから関連付ける
    const onlyOffset = Buffer.alloc(OFFSET_FIELD_SIZE);
    onlyOffset.writeUInt32BE(writeOffset);
    this.writeToFileBuffer(onlyOffset, parentHashOffsetNodeOffset);
  }

  private writeToFileBuffer(data: Buffer, offset: number) {
    this.fileBuffer.write(data, offset);
  }

  private storeHashValueAndData({
    hashValue,
    data,
  }: {
    hashValue: number;
    data: string;
  }): number {

    const dataNodeOffsetBuffer = Buffer.alloc(DATA_NODE_ENTRY_POINT.size);
    let parentDataNodeOffset = 0;
    if (this.lastDataNodeOffset > 0) {
      parentDataNodeOffset = this.lastDataNodeOffset;
    } else {
      this.fileBuffer.copyTo(DATA_NODE_ENTRY_POINT.offset, dataNodeOffsetBuffer);
      parentDataNodeOffset = dataNodeOffsetBuffer.readUInt32BE(0);
    }

    if (parentDataNodeOffset > 0) {
      // データの連結リストを辿っていき、最後に追加する
      let nextDataNodeOffset = 0;
      while (true) {
        this.fileBuffer.copyTo(parentDataNodeOffset, dataNodeOffsetBuffer);
        
        // 次のデータノードへのオフセット値
        nextDataNodeOffset = dataNodeOffsetBuffer.readUInt32BE(0);
        if (nextDataNodeOffset === 0) {
          break;
        }
        parentDataNodeOffset = nextDataNodeOffset;
      }
    } else {
      // 初めてデータを追加する場合は、ヘッダーのDATA_NODE_ENTRY_POINT
      parentDataNodeOffset = DATA_NODE_ENTRY_POINT.offset;
    }
    this.lastDataNodeOffset = parentDataNodeOffset;

    // ファイルの末尾をデータを書き込むオフセット値にする
    // (親ノードに記録する)
    const writeOffset = this.fileBuffer.size();
    dataNodeOffsetBuffer.writeUInt32BE(writeOffset, 0);
    this.writeToFileBuffer(dataNodeOffsetBuffer, parentDataNodeOffset);

    const buffers: Buffer[] = [];
    let dataNodeSize = 0;
    // 次のデータノードへのオフセット値を保存するためのプレイスホルダ
    const nextDataNodeOffsetBuffer = Buffer.alloc(OFFSET_FIELD_SIZE);
    buffers.push(nextDataNodeOffsetBuffer);
    dataNodeSize += nextDataNodeOffsetBuffer.length;
    
    // データノードのサイズ
    const dataNodeSizeBuffer = Buffer.alloc(2);
    buffers.push(dataNodeSizeBuffer);
    dataNodeSize += dataNodeSizeBuffer.length;

    // データのハッシュ値(データに対するキー)
    const hashValueBuffer = Buffer.alloc(4);
    hashValueBuffer.writeUInt32BE(hashValue);
    buffers.push(hashValueBuffer);
    dataNodeSize += hashValueBuffer.length;

    // 実データ
    const dataBuffer = Buffer.from(data);
    buffers.push(dataBuffer);
    dataNodeSize += dataBuffer.length;

    // データノード全体のサイズが確定
    dataNodeSizeBuffer.writeUInt16BE(dataNodeSize);

    // ファイルに書き込む
    const dataNodeBuffer = Buffer.concat(buffers);
    this.writeToFileBuffer(dataNodeBuffer, writeOffset);

    // 前回のデータノードと関連付ける
    const offsetBuffer = Buffer.alloc(OFFSET_FIELD_SIZE);
    offsetBuffer.writeUInt32BE(writeOffset);
    this.writeToFileBuffer(offsetBuffer, this.lastDataNodeOffset);

    // 次のためにオフセット値を持っておく
    this.lastDataNodeOffset = writeOffset;

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
      throw `Can not find the root node`;
    }

    // セマフォをロック
    await this.semaphore.enterAwait(0);

    // データをハッシュ値に変換
    const data = stringify(value);
    const hashValue = this.stringTo4ByteHash(data);

    // 新しいハッシュ値ならファイルに書き込む
    let hashValueOffset = 0;
    if (!this.dataHashValueMap.has(hashValue)) {
      hashValueOffset = this.storeHashValueAndData({
        hashValue,
        data,
      });
      this.dataHashValueMap.set(hashValue, hashValueOffset);
    } else {
      hashValueOffset = this.dataHashValueMap.get(hashValue)!;
    }

    // ルートノードの読み取り
    const offset = this.header.trieNodeOffset;
    const rootNode: ReadTrieNode | null = this.readTrieNode(offset); 
    if (!rootNode) {
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
    let siblingNode: ReadTrieNode | null;
    let childNode: ReadTrieNode | null = null;
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
          siblingNode = this.readTrieNode(task.node.siblingOffset);
          if (siblingNode) {
            queue.push({
              node: siblingNode,
              idx: task.idx,
              path: task.path,
            });
            continue;
          }
        }
  
        // 全ての兄弟ノードをチェックしたが見つからない場合、兄弟ノードを追加する
        siblingNode = {
          name: key[task.idx],
        };
        task.node.siblingOffset = this.writeTrieNode({
          trieNode: siblingNode,
          hashValueOffset: (task.idx + 1 === key.length - 1) ? hashValueOffset : undefined,
        });

        // 親ノードと作成した兄弟ノードを関連付ける
        this.writeTrieNode({
          trieNode: task.node,
        });

        task = {
          node: siblingNode,
          idx: task.idx,
          path: task.path + key[task.idx],
        };

        // 残りは全て子ノードとして作成する
        while (task.idx + 1 < key.length) {
          childNode = {
            name: key[task.idx + 1],
          };
          task.node.childOffset = this.writeTrieNode({
            trieNode: childNode,
          });
  
          // 親ノードのchildNodeOffsetに書き込む
          this.writeTrieNode({
            trieNode: task.node,
          });
          task = {
            node: childNode,
            idx: task.idx + 1,
            path: task.path + (task.idx > -1 ? key[task.idx] : ''),
          };
        }

        // 最後の1文字のときはハッシュ値を追加する（重複していたらされない）
        this.writeTrieNode({
          trieNode: task.node,
          hashValueOffset,
        });

        break;
      }
      currentIdx = Math.max(currentIdx, task.idx + 1);
      
      if (!task.node.childOffset) {
        // 子ノードがないので書き込む
        if (task.idx + 1 === key.length) {
          // 最後の1文字のときはハッシュ値を追加する（重複していたらされない）
          this.writeTrieNode({
            trieNode: task.node,
            hashValueOffset,
          });
          break;
        } else {
          childNode = {
            name: key[task.idx + 1],
            offset: this.fileBuffer.size(), // ファイルの末尾
          };
          
          // 子ノードの書き込み
          task.node.childOffset = this.writeTrieNode({
            trieNode: childNode,
          });

          // 親ノードのchildNodeOffsetに書き込む
          this.writeTrieNode({
            trieNode: task.node,
          });
        }

      } else {
        // 全ての文字が既に登録されていて、末尾にたどり着いた場合
        if (task.idx + 1 === key.length) {

          // 最後の1文字のときはハッシュ値を追加する（重複していたらされない）
          this.writeTrieNode({
            trieNode: task.node,
            hashValueOffset,
          });
          break;
        }
        // 子ノードを探索に行く
        childNode = this.readTrieNode(task.node.childOffset);
      }
      if (childNode) {
        queue.push({
          node: childNode,
          idx: task.idx + 1,
          path: task.path + (task.idx > -1 ? key[task.idx] : ''),
        });
      }
    }

    // セマフォのロックを解除
    this.semaphore.leave(0);
  }

  async close() {
    await fs.promises.writeFile(this.filePath, this.fileBuffer.getBuffer());
    this.dataHashValueMap.clear();
  }

  private stringTo4ByteHash(str: string) {
    const strBuffer = Buffer.from(str);

    let hash = 0;
    for (let i = 0; i < strBuffer.length; i++) {
      const charCode = strBuffer.at(i)!;
      hash = ((hash << 5) - hash + charCode) & 0xFFFFFFFF;
    }
    // 符号なし32ビット整数として返す
    return hash >>> 0;
  }
}

// const rows = [
//   {
//     path: '中央区',
//     value: {
//       pref: '大阪府',
//       city: '大阪市',
//       ward: '中央区',
//     },
//   },
//   {
//     path: '中央区',
//     value: {
//       pref: '北海道',
//       city: '札幌市',
//       ward: '中央区',
//     },
//   },
//   {
//     path: '静岡県沼津市',
//     value: {
//       pref: '静岡県',
//       city: '沼津市',
//       oaza_cho: undefined,
//       rsdt_addr_flg: -1,
//       prc1: undefined,
//       prc2: undefined,
//       prc3: undefined,
//       block_id: undefined,
//       block_id2: undefined,
//     },
//   },
//   {
//     path: '東京都千代田区紀尾井町',
//     value: {
//       pref: '東京都',
//       city: '千代田区',
//       oaza_cho: '紀尾井町',
//       rsdt_addr_flg: 1,
//       prc1: undefined,
//       prc2: undefined,
//       prc3: undefined,
//       block_id: undefined,
//       block_id2: undefined,
//     },
//   },
//   {
//     path: '静岡県沼津市岡一色',
//     value: {
//       pref: '静岡県',
//       city: '沼津市',
//       oaza_cho: '岡一色',
//       rsdt_addr_flg: 0,
//       prc1: undefined,
//       prc2: undefined,
//       prc3: undefined,
//       block_id: undefined,
//       block_id2: undefined,
//     },
//   },
//   {
//     path: '静岡県沼津市岡一色485-6',
//     value: {
//       pref: '静岡県',
//       city: '沼津市',
//       oaza_cho: '岡一色',
//       rsdt_addr_flg: 0,
//       prc1: 485,
//       prc2: 6,
//       prc3: undefined,
//       block_id: undefined,
//       block_id2: undefined,
//     },
//   },
//   {
//     path: '静岡県沼津市岡一色485-3',
//     value: {
//       pref: '静岡県',
//       city: '沼津市',
//       oaza_cho: '岡一色',
//       rsdt_addr_flg: 0,
//       prc1: 485,
//       prc2: 3,
//       prc3: undefined,
//       block_id: undefined,
//       block_id2: undefined,
//     },
//   },
//   {
//     path: '静岡県沼津市岡宮',
//     value: {
//       pref: '静岡県',
//       city: '沼津市',
//       oaza_cho: '岡宮',
//       rsdt_addr_flg: 0,
//       prc1: undefined,
//       prc2: undefined,
//       prc3: undefined,
//       block_id: undefined,
//       block_id2: undefined,
//     },
//   },
//   {
//     path: '静岡県沼津市岡宮421',
//     value: {
//       pref: '静岡県',
//       city: '沼津市',
//       oaza_cho: '岡宮',
//       rsdt_addr_flg: 0,
//       prc1: 421,
//       prc2: undefined,
//       prc3: undefined,
//       block_id: undefined,
//       block_id2: undefined,
//     },
//   },
//   {
//     path: '静岡県三島市加茂川町',
//     value: {
//       pref: '静岡県',
//       city: '三島市',
//       oaza_cho: '加茂川町',
//       rsdt_addr_flg: 0,
//       prc1: undefined,
//       prc2: undefined,
//       prc3: undefined,
//       block_id: undefined,
//       block_id2: undefined,
//     },
//   },
//   {
//     path: '静岡県三島市加茂川町123',
//     value: {
//       pref: '静岡県',
//       city: '三島市',
//       oaza_cho: '加茂川町',
//       rsdt_addr_flg: 0,
//       prc1: 123,
//       prc2: undefined,
//       prc3: undefined,
//       block_id: undefined,
//       block_id2: undefined,
//     },
//   },
//   {
//     path: '東京都千代田区紀尾井町1-3',
//     value: {
//       pref: '東京都',
//       city: '千代田区',
//       oaza_cho: '紀尾井町',
//       rsdt_addr_flg: 1,
//       prc1: undefined,
//       prc2: undefined,
//       prc3: undefined,
//       block_id: 1,
//       block_id2: 3,
//     },
//   },
//   {
//     path: '東京都千代田区紀尾井町1',
//     value: {
//       pref: '東京都',
//       city: '千代田区',
//       oaza_cho: '紀尾井町',
//       rsdt_addr_flg: 1,
//       prc1: undefined,
//       prc2: undefined,
//       prc3: undefined,
//       block_id: 1,
//       block_id2: undefined,
//     },
//   },
//   {
//     path: '東京都調布市国領町3-8-15',
//     value: {
//       pref: '東京都',
//       city: '調布市',
//       oaza_cho: '国領町',
//       rsdt_addr_flg: 0,
//       prc1: 3,
//       prc2: 8,
//       prc3: 15,
//       block_id: undefined,
//       block_id2: undefined,
//     },
//   },
//   {
//     path: '東京都調布市国領町',
//     value: {
//       pref: '東京都',
//       city: '調布市',
//       oaza_cho: '国領町',
//       rsdt_addr_flg: 0,
//       prc1: undefined,
//       prc2: undefined,
//       prc3: undefined,
//       block_id: undefined,
//       block_id2: undefined,
//     },
//   },
// ];

// const dataMap = new Map<number, { [key: string]: unknown }>();
// const rootNode = new TrieNode({
//   name: '',
// });
// rows.forEach(row => {
//   let parent = rootNode;
//   dataMap.set(row.hash, row.value);
//   for (const char of row.path) {
//     let child = parent.getChild(char);
//     if (!child) {
//       child = new TrieNode({
//         name: char,
//       });
//       parent.addChild(child);
//     }
//     parent = child;
//   };
//   parent.hashValue = row.hash;
// });

// dataMapの変換
// const shortDataMap = {};
// for (const [hash, value] of Object.entries(dataMap)) {
//   shortDataMap[hash] = convertToShortFields(value, fieldMapping);
// }

// 変換後のshortDataMapを使用して、トライ木を書き込む
// (async () => {
//   await fs.promises.unlink('test-with-paging.bin');
//   const writer = await FileTrieWriter.openFile('test-with-paging.bin');

//   for (const row of rows) {
//     await writer?.addNode({
//       key: row.path, 
//       value: row.value
//     });
//   }

//   await writer?.close();
// })();
