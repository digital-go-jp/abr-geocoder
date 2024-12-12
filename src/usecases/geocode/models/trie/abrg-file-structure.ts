export type AbrgBytes = {
  offset: number;
  description: string;
  size: number;
};

export const OFFSET_FIELD_SIZE = 4;
export type TrieHashListNode = {
  hashValueOffset: number;
  offset: number;
  next?: TrieHashListNode;
};
export type DataNode = {
  data: Buffer;
  nodeSize: number;
  hashValue: bigint;
  offset: number;
  nextDataNodeOffset: number;
  next?: DataNode;
}

export type ReadTrieNode = {
  name: string;
  offset?: number;
  childOffset?: number;
  siblingOffset?: number;

  // トライ木ノードに複数の値（同じキーだけど異なる値）を関連付けられるようにするため
  // ノードに対する関連付けるハッシュ値の連結リストを保存する必要がある。
  // そのための先頭オフセット値
  hashValueList?: TrieHashListNode;
  nodeSize?: number;
};
export type WriteTrieNode = {
  name: string;
  offset?: number;
  childOffset?: number;
  siblingOffset?: number;
  hashValueList?: TrieHashListNode;
};

export type AbrgDictHeader = {
  version: {
    major: number;
    minor: number;
  },
  trieNodeOffset: number;
  dataNodeOffset: number | null,
  headerSize: number;
};

export const ABRG_FILE_MAGIC: AbrgBytes = {
  offset: 0,
  description: 'ファイルマジック("abrg")',
  size: 4,
};
export const ABRG_FILE_HEADER_SIZE: AbrgBytes = {
  offset: ABRG_FILE_MAGIC.offset + ABRG_FILE_MAGIC.size,
  description: 'ヘッダーサイズ',
  size: 2,
};
export const VERSION_BYTES: AbrgBytes = {
  offset: ABRG_FILE_HEADER_SIZE.offset + ABRG_FILE_HEADER_SIZE.size,
  description: 'バージョン(major, minor)',
  size: 2,
};
export const TRIE_NODE_ENTRY_POINT: AbrgBytes = {
  offset: VERSION_BYTES.offset + VERSION_BYTES.size,
  description: 'トライノードへのオフセット値',
  size: OFFSET_FIELD_SIZE,
};
export const DATA_NODE_ENTRY_POINT: AbrgBytes = {
  offset: TRIE_NODE_ENTRY_POINT.offset + TRIE_NODE_ENTRY_POINT.size,
  description: 'データノードへのオフセット値',
  size: OFFSET_FIELD_SIZE,
};

export const TRIE_NODE_SIZE_FIELD: AbrgBytes = {
  offset: 0,
  description: 'トライ木ノードのサイズ',
  size: 1,
};

export const TRIE_NODE_SIBLING_OFFSET: AbrgBytes = {
  offset: TRIE_NODE_SIZE_FIELD.offset + TRIE_NODE_SIZE_FIELD.size,
  description: '兄弟ノードへのオフセット値',
  size: OFFSET_FIELD_SIZE,
};

export const TRIE_NODE_CHILD_OFFSET: AbrgBytes = {
  offset: TRIE_NODE_SIBLING_OFFSET.offset + TRIE_NODE_SIBLING_OFFSET.size,
  description: '子ノードへのオフセット値',
  size: OFFSET_FIELD_SIZE,
};

export const TRIE_NODE_HASH_LINKED_LIST_OFFSET: AbrgBytes = {
  offset: TRIE_NODE_CHILD_OFFSET.offset + TRIE_NODE_CHILD_OFFSET.size,
  description: 'ノードのhashValueへのオフセット値',
  size: OFFSET_FIELD_SIZE,
};


export const DATA_NODE_NEXT_OFFSET: AbrgBytes = {
  offset: 0,
  description: '次のデータノードへのオフセット値',
  size: OFFSET_FIELD_SIZE,
};

export const DATA_NODE_SIZE_FIELD: AbrgBytes = {
  offset: DATA_NODE_NEXT_OFFSET.offset + DATA_NODE_NEXT_OFFSET.size,
  description: 'データノードのサイズ',
  size: 2,
};
export const DATA_NODE_HASH_VALUE: AbrgBytes = {
  offset: DATA_NODE_SIZE_FIELD.offset + DATA_NODE_SIZE_FIELD.size,
  description: 'データノードのハッシュ値',
  size: 8,
};


export const HASH_LINK_NODE_NEXT_OFFSET: AbrgBytes = {
  offset: 0,
  description: '次のハッシュオフセットノードへのオフセット値',
  size: OFFSET_FIELD_SIZE,
};

export const HASH_LINK_NODE_OFFSET_VALUE: AbrgBytes = {
  offset: HASH_LINK_NODE_NEXT_OFFSET.offset + HASH_LINK_NODE_NEXT_OFFSET.size,
  description: 'ハッシュ値へのオフセット',
  size: OFFSET_FIELD_SIZE,
};
