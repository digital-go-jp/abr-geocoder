import fs from 'node:fs';
import { Writable } from 'node:stream';

class TrieNode {
  public readonly name: string;
  public hashValue?: number | undefined;
  public readonly children = new Map<string, TrieNode>();
  constructor({
    name,
    hashValue = undefined,
  }: {
    name: string;
    hashValue?: number | undefined;
  }) {
    this.name = name;
    this.hashValue = hashValue;
  }

  addChild(node: TrieNode) {
    if (this.children.has(node.name)) {
      return;
    }
    this.children.set(node.name, node);
  }

  getChild(nodeName: string) {
    return this.children.get(nodeName);
  }
  hasChild(nodeName: string) {
    return this.children.has(nodeName);
  }
}

class FileTrieWriter {
  private readonly rootNode: TrieNode;
  private readonly dataMap: Map<number, { [key: string]: unknown }>;
  private readonly headerSize = 12; // ヘッダー領域のバイト数
  private currentOffset: number = this.headerSize;

  // 各ノードのサイズをセグメントの最初に書き込む必要があるが
  // streamを使っている関係上、書き込みのタイミングではサイズが分からない。
  // なので、全て書き終えたあとに、あとからファイルに上書きする
  private nodeSizeList: { offset: number; size: number; }[] = [];

  constructor({
    rootNode,
    dataMap,
  }: {
    rootNode: TrieNode;
    dataMap: Map<number, { [key: string]: unknown }>;
  }) {
    this.rootNode = rootNode;
    this.dataMap = dataMap;
  }

  // ノード全体をバイナリデータにエンコードしストリームに書き込む
  _writeNode(node: TrieNode, stream: Writable) {
    // ノードの情報を記録するセグメントの開始アドレスを記憶
    const offset = this.currentOffset;

    // 一時的にファイルにノードサイズを書き込むためのプレースホルダーを書き込む(4バイト)
    const nodeSizeBuffer = Buffer.alloc(4);
    stream.write(nodeSizeBuffer);
    this.currentOffset += 4;
    
    // ノード名(1バイト+0〜4バイト)
    const nameLengthBuffer = Buffer.alloc(1);
    if (node.name) {
      // 1文字以上
      const nameBuffer = Buffer.from(node.name, 'utf8');
      nameLengthBuffer.writeUInt8(nameBuffer.length);
      this.currentOffset += nameLengthBuffer.length + nameBuffer.length;
      stream.write(nameLengthBuffer);
      stream.write(nameBuffer);
    } else {
      // 0文字のときは名前の領域を書かない
      nameLengthBuffer.writeUInt8(0);
      stream.write(nameLengthBuffer);
      this.currentOffset += nameLengthBuffer.length;
    }

    // 子ノード数
    const childCountBuffer = Buffer.alloc(1);
    childCountBuffer.writeUInt8(node.children.size);
    stream.write(childCountBuffer);
    this.currentOffset += childCountBuffer.length;

    // ハッシュ値の有無(1バイト)
    const hashLengthBuffer = Buffer.alloc(1);
    hashLengthBuffer.writeUInt8(!node.hashValue ? 0 : 1);
    stream.write(hashLengthBuffer);
    this.currentOffset += hashLengthBuffer.length;

    if (node.hashValue) {
      // ノードに関連付けるハッシュ値(4バイト)
      const hashBuffer = Buffer.alloc(4);
      hashBuffer.writeUInt32BE(node.hashValue);
      stream.write(hashBuffer);
      this.currentOffset += hashBuffer.length;
    }

    const children = Array.from(node.children.values());
    // children.sort((a, b) => a.name.localeCompare(b.name));

    // 子ノードを再帰的に書き込み
    children.forEach(child =>  this._writeNode(child, stream));

    const nodeSize = this.currentOffset - offset;
    this.nodeSizeList.push({
      offset,
      size: nodeSize,
    });
    console.log({
      name: node.name,
      offset: `0x${offset.toString(16)}`,
      size: nodeSize,
    })

    return nodeSize;
  }

  _writeDataRegion(stream: Writable) {
    for (const [hash, dict] of this.dataMap.entries()) {
      const hashBuffer = Buffer.alloc(4);
      hashBuffer.writeUInt32BE(hash);

      const dictString = JSON.stringify(dict);
      const dictBuffer = Buffer.from(dictString, 'utf8');
      const dictLengthBuffer = Buffer.alloc(4);
      dictLengthBuffer.writeUInt32BE(dictBuffer.length);

      stream.write(hashBuffer);
      stream.write(dictLengthBuffer);
      stream.write(dictBuffer);
    }
  }

  async writeToFile(filePath: string) {
    // 一時的にファイルにヘッダーサイズ分のプレースホルダーを書き込む
    const headerPlaceholder = Buffer.alloc(this.headerSize);
    const writeStream = fs.createWriteStream(filePath);
    writeStream.write(headerPlaceholder);

    // トライ木を書き込む
    this.nodeSizeList = [];
    this._writeNode(this.rootNode, writeStream);

    // 書き込みストリームを閉じる
    await new Promise(resolve => writeStream.end(resolve));

    // ヘッダーを書き換えるためにファイルを開き直す
    const dataRegionOffset = this.currentOffset;
    const headerBuffer = Buffer.alloc(this.headerSize);
    let offset = 0;
    headerBuffer.write("abrg", offset, 4, "utf8"); // "abrg" マジックナンバー
    offset += 4;
    headerBuffer.writeUInt16BE(this.headerSize, offset); // ヘッダーサイズ
    offset += 2;

    headerBuffer.writeUInt8(2, offset); // 作成したabrgのメジャーバージョン番号
    offset += 1;
    headerBuffer.writeUInt8(3, offset); // 作成したabrgのマイナーバージョン番号
    offset += 1;
    headerBuffer.writeUInt32BE(dataRegionOffset, offset); // データ領域の先頭オフセット
    offset += 4;

    const fd = await fs.promises.open(filePath, 'r+');
    // ヘッダーの書き込み
    await fd.write(headerBuffer, 0, offset, 0);

    // 各セグメント毎のサイズの書き込み
    const segmentSizeBuffer = Buffer.alloc(4);
    for (const info of this.nodeSizeList) {
      segmentSizeBuffer.writeUInt32BE(info.size);
      await fd.write(segmentSizeBuffer, 0, segmentSizeBuffer.length, info.offset);
    }
    await fd.close();

    // データ領域を書き込む
    const dataWriteStream = fs.createWriteStream(filePath, { flags: 'a' });
    this._writeDataRegion(dataWriteStream);
    await new Promise(resolve => dataWriteStream.end(resolve));

    console.log(`Trie and data region written to ${filePath} with header.`);
  }
}

const rows = [
  {
    path: '静岡県沼津市',
    value: {
      pref: '静岡県',
      city: '沼津市',
      oaza_cho: undefined,
      rsdt_addr_flg: -1,
      prc1: undefined,
      prc2: undefined,
      prc3: undefined,
      block_id: undefined,
      block_id2: undefined,
    },
    hash: 3331,
  },
  {
    path: '静岡県沼津市岡一色',
    value: {
      pref: '静岡県',
      city: '沼津市',
      oaza_cho: '岡一色',
      rsdt_addr_flg: 0,
      prc1: undefined,
      prc2: undefined,
      prc3: undefined,
      block_id: undefined,
      block_id2: undefined,
    },
    hash: 112,
  },
  {
    path: '静岡県沼津市岡一色485-6',
    value: {
      pref: '静岡県',
      city: '沼津市',
      oaza_cho: '岡一色',
      rsdt_addr_flg: 0,
      prc1: 485,
      prc2: 6,
      prc3: undefined,
      block_id: undefined,
      block_id2: undefined,
    },
    hash: 1,
  },
  {
    path: '静岡県沼津市岡一色485-3',
    value: {
      pref: '静岡県',
      city: '沼津市',
      oaza_cho: '岡一色',
      rsdt_addr_flg: 0,
      prc1: 485,
      prc2: 3,
      prc3: undefined,
      block_id: undefined,
      block_id2: undefined,
    },
    hash: 2,
  },
  {
    path: '静岡県沼津市岡宮',
    value: {
      pref: '静岡県',
      city: '沼津市',
      oaza_cho: '岡宮',
      rsdt_addr_flg: 0,
      prc1: undefined,
      prc2: undefined,
      prc3: undefined,
      block_id: undefined,
      block_id2: undefined,
    },
    hash: 3134,
  },
  {
    path: '静岡県沼津市岡宮421',
    value: {
      pref: '静岡県',
      city: '沼津市',
      oaza_cho: '岡宮',
      rsdt_addr_flg: 0,
      prc1: 421,
      prc2: undefined,
      prc3: undefined,
      block_id: undefined,
      block_id2: undefined,
    },
    hash: 3,
  },
  {
    path: '静岡県三島市加茂川町',
    value: {
      pref: '静岡県',
      city: '三島市',
      oaza_cho: '加茂川町',
      rsdt_addr_flg: 0,
      prc1: undefined,
      prc2: undefined,
      prc3: undefined,
      block_id: undefined,
      block_id2: undefined,
    },
    hash: 552,
  },
  {
    path: '静岡県三島市加茂川町123',
    value: {
      pref: '静岡県',
      city: '三島市',
      oaza_cho: '加茂川町',
      rsdt_addr_flg: 0,
      prc1: 123,
      prc2: undefined,
      prc3: undefined,
      block_id: undefined,
      block_id2: undefined,
    },
    hash: 4,
  },
  {
    path: '東京都千代田区紀尾井町',
    value: {
      pref: '東京都',
      city: '千代田区',
      oaza_cho: '紀尾井町',
      rsdt_addr_flg: 1,
      prc1: undefined,
      prc2: undefined,
      prc3: undefined,
      block_id: 1,
      block_id2: 3,
    },
    hash: 6672,
  },
  {
    path: '東京都千代田区紀尾井町1-3',
    value: {
      pref: '東京都',
      city: '千代田区',
      oaza_cho: '紀尾井町',
      rsdt_addr_flg: 1,
      prc1: undefined,
      prc2: undefined,
      prc3: undefined,
      block_id: 1,
      block_id2: 3,
    },
    hash: 5,
  },
  {
    path: '東京都千代田区紀尾井町1',
    value: {
      pref: '東京都',
      city: '千代田区',
      oaza_cho: '紀尾井町',
      rsdt_addr_flg: 1,
      prc1: undefined,
      prc2: undefined,
      prc3: undefined,
      block_id: 1,
      block_id2: undefined,
    },
    hash: 6,
  },
  {
    path: '東京都調布市国領町3-8-15',
    value: {
      pref: '東京都',
      city: '調布市',
      oaza_cho: '国領町',
      rsdt_addr_flg: 0,
      prc1: 3,
      prc2: 8,
      prc3: 15,
      block_id: undefined,
      block_id2: undefined
    },
    hash: 7,
  },
  {
    path: '東京都調布市国領町',
    value: {
      pref: '東京都',
      city: '調布市',
      oaza_cho: '国領町',
      rsdt_addr_flg: 0,
      prc1: undefined,
      prc2: undefined,
      prc3: undefined,
      block_id: undefined,
      block_id2: undefined
    },
    hash: 832,
  }
]

const dataMap = new Map<number, { [key: string]: unknown }>();
const rootNode = new TrieNode({
  name: '',
});
rows.forEach(row => {
  let parent = rootNode;
  dataMap.set(row.hash, row.value);
  for (const char of row.path) {
    let child = parent.getChild(char);
    if (!child) {
      child = new TrieNode({
        name: char,
      });
      parent.addChild(child);
    }
    parent = child;
  };
  parent.hashValue = row.hash;
});

// dataMapの変換
// const shortDataMap = {};
// for (const [hash, value] of Object.entries(dataMap)) {
//   shortDataMap[hash] = convertToShortFields(value, fieldMapping);
// }

// 変換後のshortDataMapを使用して、トライ木を書き込む
const writer = new FileTrieWriter({
  rootNode,
  dataMap,
});
writer.writeToFile('test-with-paging.bin');
