import { ABRG_FILE_HEADER_SIZE, ABRG_FILE_MAGIC, AbrgDictHeader, DATA_NODE_ENTRY_POINT, DATA_NODE_HASH_VALUE, DATA_NODE_NEXT_OFFSET, DATA_NODE_SIZE_FIELD, DataNode, HASH_LINK_NODE_NEXT_OFFSET, HASH_LINK_NODE_OFFSET_VALUE, ReadTrieNode, TRIE_NODE_CHILD_OFFSET, TRIE_NODE_ENTRY_POINT, TRIE_NODE_HASH_LINKED_LIST_OFFSET, TRIE_NODE_SIBLING_OFFSET, TRIE_NODE_SIZE_FIELD, TrieHashListNode, VERSION_BYTES } from "./abrg-file-structure";
import { CharNode } from "./char-node";
import { ExpandableBuffer } from "./expandable-buffer";

export class TrieFinderResult<T> {
  public readonly info: T | undefined;
  public readonly unmatched: CharNode | undefined;
  public readonly depth: number;
  public readonly ambiguousCnt: number;

  constructor(params: {
    info: T | undefined;
    unmatched: CharNode | undefined;
    depth: number;
    ambiguousCnt: number;
  }) {
    this.info = params.info;
    this.unmatched = params.unmatched;
    this.depth = params.depth;
    this.ambiguousCnt = params.ambiguousCnt;
    Object.freeze(this);
  }
}

export class TrieTreeBuilderFinderCommon {

  protected readonly dataHashValueMap: Map<number, number> = new Map();
  protected readonly trieNodeMap: Map<number, ReadTrieNode | null> = new Map();
  protected readonly trieHashListNodeMap: Map<number, TrieHashListNode> = new Map();
  protected readonly fileBuffer: ExpandableBuffer;
  protected debug: boolean = false;
  
  constructor(initData?: Buffer) {
    if (!initData) {
      this.fileBuffer = new ExpandableBuffer(Buffer.alloc(ABRG_FILE_HEADER_SIZE.size));
    } else {
      this.fileBuffer = new ExpandableBuffer(initData);
    }
  }

  protected readHeader(): AbrgDictHeader | null {

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

  protected createHashValueList(nodeOffset: number) {
    const headValueList: TrieHashListNode = {
      hashValueOffset: 0,
      offset: 0,
      next: undefined,
    };
    let tailHashValueList: TrieHashListNode = headValueList;
    let storedHashValueOffset: number = 0;
    // トライ木ノードに紐づいているデータノードへのオフセット値を読むこむ
    let currentOffset = this.fileBuffer.readUInt32BE(nodeOffset + TRIE_NODE_HASH_LINKED_LIST_OFFSET.offset);
    if (this.debug) {
      console.log(`(read)${currentOffset} at ${nodeOffset + TRIE_NODE_HASH_LINKED_LIST_OFFSET.offset}`);
    }
    let nextOffset: number = 0;
    // ハッシュ値へのオフセット値の連結リストを読み取るためのバッファ
    const hashLinkNodeBuffer = Buffer.alloc(
      HASH_LINK_NODE_NEXT_OFFSET.size +
      HASH_LINK_NODE_OFFSET_VALUE.size,
    );
    
    while (currentOffset) {
      // ハッシュ値へのオフセット値への連結リストを読み取る
      const bytesRead = this.fileBuffer.copyTo(currentOffset, hashLinkNodeBuffer);
      if (bytesRead < hashLinkNodeBuffer.length) {
        throw `Can not read the hashLinkNode at ${currentOffset}`;
      }

      // 次のハッシュオフセットノードへのオフセット値
      nextOffset = hashLinkNodeBuffer.readUInt32BE(HASH_LINK_NODE_NEXT_OFFSET.offset);
      // 保存されているハッシュ値へのオフセット値
      storedHashValueOffset = hashLinkNodeBuffer.readUInt32BE(HASH_LINK_NODE_OFFSET_VALUE.offset);
      // リストを作成する
      tailHashValueList.next = {
        hashValueOffset: storedHashValueOffset,
        offset: currentOffset,
        next: undefined,
      };
      // 次に進む
      tailHashValueList = tailHashValueList.next;
      currentOffset = nextOffset;
    }
    return headValueList.next;
  }


  // ノード情報を読み込む
  protected readTrieNode(nodeOffset: number): ReadTrieNode | null {
    if (this.trieNodeMap.has(nodeOffset)) {
      return this.trieNodeMap.get(nodeOffset)!;
    }

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
    const headValueList = this.createHashValueList(nodeOffset);
    offset += TRIE_NODE_HASH_LINKED_LIST_OFFSET.size;

    // ノード名
    let name = '';
    if (offset < nodeSize) {
      name = nodeBuffer.toString('utf8', offset, nodeSize);
      offset += nodeSize - offset;
    }
    const readTrieNode = {
      name,
      offset: nodeOffset,
      childOffset: childOffset === 0 ? undefined : childOffset,
      siblingOffset: siblingOffset === 0 ? undefined : siblingOffset,
      hashValueList: headValueList,
      nodeSize,
    };
    this.trieNodeMap.set(nodeOffset, readTrieNode);

    return readTrieNode;
  }

  protected readDataNode(hashValueOffset: number): DataNode {
    let offset = hashValueOffset;

    // 次のデータノードのアドレス
    const nextDataNodeOffset = this.fileBuffer.readUInt32BE(hashValueOffset);
    offset += DATA_NODE_NEXT_OFFSET.size;

    // データノードのサイズ
    let nodeSize = this.fileBuffer.readUInt16BE(offset);
    offset += DATA_NODE_SIZE_FIELD.size;

    // データに対するハッシュ値
    const hashValue = this.fileBuffer.readUInt32BE(offset);
    offset += DATA_NODE_HASH_VALUE.size;

    // 実データ
    let data = undefined;
    if (nodeSize > 0) {
      const dataStr = this.fileBuffer.toString('utf8', offset, hashValueOffset + nodeSize);
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
