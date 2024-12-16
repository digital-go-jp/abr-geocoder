import fs from 'node:fs';
import { ABRG_FILE_HEADER_SIZE, ABRG_FILE_MAGIC, AbrgDictHeader, DATA_NODE_ENTRY_POINT, DATA_NODE_HASH_VALUE, DATA_NODE_NEXT_OFFSET, DATA_NODE_SIZE_FIELD, DataNode, HASH_LINK_NODE_NEXT_OFFSET, HASH_LINK_NODE_OFFSET_VALUE, ReadTrieNode, TRIE_NODE_CHILD_OFFSET, TRIE_NODE_ENTRY_POINT, TRIE_NODE_HASH_LINKED_LIST_OFFSET, TRIE_NODE_SIBLING_OFFSET, TRIE_NODE_SIZE_FIELD, TrieHashListNode, VERSION_BYTES } from "./abrg-file-structure";

export class TrieTreeBuilderBase {

  protected readonly trieNodeMap: Map<number, ReadTrieNode | null> = new Map();
  protected readonly trieHashListNodeMap: Map<number, TrieHashListNode> = new Map();
  protected debug: boolean = false;
  private fileBuffer: Buffer = Buffer.alloc(8 * 1024 * 1024); // 8MB
  private fileBufferStart: number = 0;
  private fileBufferSize: number = 0;
  
  constructor(
    protected readonly fd: fs.promises.FileHandle, 
    protected fileSize: number = 0,
  ) { }

  async close() {
    await this.flush();
    await this.fd.close();
  }
  
  private async flush() {
    if (this.fileBufferSize === 0) {
      return;
    }

    // バッファデータを書き出す
    // (書き込んだ位置よりも前を読み出すことが頻繁にあるので、前の部分を残しておく)
    await this.fd.write(
      // buffer
      this.fileBuffer,
      // offset
      0,
      // length
      this.fileBufferSize,
      // position
      this.fileBufferStart,
    );
  }

  protected async write(data: Buffer, position: number) {
    if (this.debug) {
      console.log(`==>[write] position: ${position}, data: ${data.length}, start: ${this.fileBufferStart}, size:${this.fileBufferSize}`);
    } 

    if (position < this.fileBufferStart) {
      // 現在のfileBufferStartよりも前の場合、childNodeOffsetやsiblingNodeOffsetなど、
      // 小さなデータの可能性が高いので、ファイルに直接書き込む
      await this.fd.write(
        // buffer
        data,
        // offset
        0,
        // length
        data.length,
        // position
        position,
      );
      return;
    }

    // ファイルに最終的に書き込むためのバッファに書き込む
    if (position + data.length > this.fileBufferStart + this.fileBufferSize) {
      // this.fileBufferSize を拡張してカバーできる場合は、拡張して対応する
      if (this.fileBufferStart <= position && 
        position + data.length < this.fileBufferStart + this.fileBuffer.length) {
        this.fileBufferSize = (position + data.length) - this.fileBufferStart;
      } else {
        // バッファデータを書き出す
        await this.flush();
        this.fileBufferStart = position;
        this.fileBufferSize = data.length;
      }
    }
    data.copy(
      // target
      this.fileBuffer,
      // targetStart
      position - this.fileBufferStart,
    );
    this.fileSize = Math.max(this.fileSize, this.fileBufferStart + this.fileBufferSize);
  }

  protected async read(position: number, size: number): Promise<Buffer> {
    if (this.debug) {
      console.log(`==>[read] position: ${position}, data: ${size}, start: ${this.fileBufferStart}, size:${this.fileBufferSize}`);
    }
    const result = Buffer.alloc(size);

    // バッファがカバーしている範囲外の場合は、ファイルから直接読み込む
    if (position < this.fileBufferStart || position + size > this.fileBufferStart + this.fileBufferSize) {
      await this.fd.read(
        // target
        result,
        // offset
        0,
        // length
        size,
        // position
        position,
      )
      return result;
    }

    // バッファからデータを読み込む
    if (this.fileBufferStart <= position && position + size <= this.fileBufferStart + this.fileBufferSize) {
      this.fileBuffer.copy(
        // target
        result,
        // targetStart
        0,
        // sourceStart
        position - this.fileBufferStart,
        // sourceEnd (not inclusive)
        position + size - this.fileBufferStart,
      );
    }
    return result;
  }

  protected async readUInt8(offset: number): Promise<number> {
    const result = await this.read(offset, 1);
    return result.readUInt8(0);
  }
  
  protected async readUInt16BE(offset: number): Promise<number> {
    const result = await this.read(offset, 2);
    return result.readUInt16BE(0);
  }
  
  protected async readUInt32BE(offset: number): Promise<number> {
    const result = await this.read(offset, 4);
    return result.readUInt32BE(0);
  }
  protected async readBigUInt64BE(offset: number): Promise<bigint> {
    const result = await this.read(offset, 8);
    return result.readBigUInt64BE(0);
  }
  protected async copyTo(offset: number, dst: Buffer): Promise<number> {
    const result = await this.read(offset, dst.length);
    result.copy(dst, 0, 0, result.length);
    return result.length;
  }
  
  protected async readHeader(): Promise<AbrgDictHeader | null> {

    // ファイル先頭6バイトを読み込む
    const first6BytesBuffer = await this.read(0, ABRG_FILE_MAGIC.size + ABRG_FILE_HEADER_SIZE.size);

    // ファイルマジックの確認 (先頭4バイト)
    const name = first6BytesBuffer.toString('ascii', 0, ABRG_FILE_MAGIC.size);
    if (name !== 'abrg') {
      return null;
    }

    // ヘッダーサイズ
    const headerSize = first6BytesBuffer.readUint16BE(ABRG_FILE_HEADER_SIZE.offset);

    // ヘッダー全体の読み込み
    const headerBuffer = await this.read(0, headerSize);
    
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

  protected async createHashValueList(nodeOffset: number) {
    const headValueList: TrieHashListNode = {
      hashValueOffset: 0,
      offset: 0,
      next: undefined,
    };
    let tailHashValueList: TrieHashListNode = headValueList;
    let storedHashValueOffset: number = 0;
    // トライ木ノードに紐づいているデータノードへのオフセット値を読むこむ
    let currentOffset = await this.readUInt32BE(nodeOffset + TRIE_NODE_HASH_LINKED_LIST_OFFSET.offset);
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
      const bytesRead = await this.copyTo(currentOffset, hashLinkNodeBuffer);
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
  protected async readTrieNode(nodeOffset: number): Promise<ReadTrieNode | null> {
    if (this.trieNodeMap.has(nodeOffset)) {
      return this.trieNodeMap.get(nodeOffset)!;
    }

    // ノードサイズを読み取る(1)
    const nodeSize = await this.readUInt8(nodeOffset + TRIE_NODE_SIZE_FIELD.offset);

    // ノード全体を読み取る
    const nodeBuffer = await this.read(nodeOffset, nodeSize);
    
    // nodeBufferを読み取るためのオフセット値
    let offset = TRIE_NODE_SIZE_FIELD.offset + TRIE_NODE_SIZE_FIELD.size;

    // 兄弟ノードへのオフセット値
    const siblingOffset = nodeBuffer.readUInt32BE(TRIE_NODE_SIBLING_OFFSET.offset);
    offset += TRIE_NODE_SIBLING_OFFSET.size;

    // 子ノードへのオフセット値
    const childOffset = nodeBuffer.readUInt32BE(TRIE_NODE_CHILD_OFFSET.offset);
    offset += TRIE_NODE_CHILD_OFFSET.size;

    // データノードへのオフセット値の連結リスト
    const headValueList = await this.createHashValueList(nodeOffset);
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



  protected async readDataNode(hashValueOffset: number, expectHashValue?: BigInt): Promise<DataNode | undefined> {
    let offset = 0;
    if (hashValueOffset === 0) {
      return undefined;
    }

    // 次のデータノードのアドレス
    const nextDataNodeOffset = await this.readUInt32BE(hashValueOffset);
    offset += DATA_NODE_NEXT_OFFSET.size;

    // データノードのサイズ
    let nodeSize = await this.readUInt16BE(offset + hashValueOffset);
    offset += DATA_NODE_SIZE_FIELD.size;

    // データに対するハッシュ値
    const hashValue = await this.readBigUInt64BE(offset + hashValueOffset);
    offset += DATA_NODE_HASH_VALUE.size;
    // expectHashValueが指定されている時、hashValueが異なる場合は読み取り終了
    if (expectHashValue && expectHashValue !== hashValue) {
      return undefined;
    }

    // 実データ
    let data = Buffer.alloc(0);
    const result: DataNode = {
      data,
      nodeSize,
      hashValue,
      offset: hashValueOffset,
      nextDataNodeOffset,
      next: undefined,
    };
    const dataRegionSize = nodeSize - offset;
    if (dataRegionSize > 0) {
      result.data = await this.read(offset + hashValueOffset, dataRegionSize);
      if (nextDataNodeOffset > 0) {
        result.next = await this.readDataNode(nextDataNodeOffset, hashValue);
      }
    }
     
    return result;
  }

  async toString(encoding: BufferEncoding, start: number, end: number): Promise<string> {
    const buffer = await this.read(start, end - start);
    return buffer.toString(encoding, 0, end - start);
  }
}
