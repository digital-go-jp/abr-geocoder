import fs from 'node:fs';
import { CharNode } from './char-node';
import { DEFAULT_FUZZY_CHAR } from '@config/constant-values';

export interface ITraverse {
  next: ITraverse | undefined;
  target: CharNode | undefined;
  matchedCnt: number;
  ambigousCnt: number;
  currentOffset?: number;
  hashValue?: number | undefined;
  lastPartialMatch?: ITraverse;
  path: string;
  bounce: number;
  allowExtraChallenge?: boolean;
}

class FileTrieResults {
  private readonly holder: Map<number, ITraverse> = new Map();

  add(value: ITraverse) {
    if (!value.hashValue) {
      console.log(value);
      throw `value.hashValue must not be a zero`;
    }
    // 過去のマッチした結果よりも良い結果なら保存する
    const hashValue = value.hashValue;
    const before = this.holder.get(hashValue);
    if (!before || before.matchedCnt - before.ambigousCnt < value.matchedCnt - value.ambigousCnt) {
      this.holder.set(hashValue, value);
    }
  }

  values() {
    return this.holder.values();
  }
}

class FileTrieReader {
  // ヘッダー領域のサイズ
  private readonly headerSize: number;

  // データ領域のオフセット
  private readonly dataRegionOffset: number;

  constructor(private readonly buffer: Buffer) {
    const header = this.readHeader();
    this.headerSize = header.headerSize;
    this.dataRegionOffset = header.dataRegionOffset;

    // console.log(`headerSize: ${header.headerSize} bytes`);
    // console.log(`version: ${header.version.major}.${header.version.minor}`);
    // console.log(`dataOffset: 0x${header.dataRegionOffset.toString(16)}`);
    // console.log("");
  }

  private readHeader() {
    let offset = 0;

    // ファイルマジックの確認
    const magic = this.buffer.toString('utf8', offset, 4);
    if (magic !== 'abrg') {
      throw new Error('Invalid file format');
    }
    offset += 4;

    // ヘッダーサイズを取得
    const headerSize = this.buffer.readUInt16BE(offset);
    offset += 2;

    // 書き込んだバージョンを確認
    // (将来的にバージョンの互換性をチェックするために使用する)
    const majorVersion = this.buffer.readUInt8(offset);
    offset += 1;
    const minorVersion = this.buffer.readUInt8(offset);
    offset += 1;

    // データ領域のオフセット値を取得
    const dataRegionOffset = this.buffer.readUInt32BE(offset);
    offset += 4;

    return {
      version: {
        major: majorVersion,
        minor: minorVersion,
      },
      dataRegionOffset,
      headerSize,
    };
  }


  // ノード情報を読み込む
  private readNode(offset: number) {
    const nodeSize = this.buffer.readUInt32BE(offset); // 4バイトでノードサイズを読み取る
    offset += 4;

    // ノード名の長さ
    const nameLength = this.buffer.readUInt8(offset);
    offset += 1;

    // ノード名
    const name = this.buffer.toString('utf8', offset, offset + nameLength);
    offset += nameLength;

    // 子要素数
    const childCount = this.buffer.readUInt8(offset);
    offset += 1;

    // ハッシュ値の有無
    const existHashValue = this.buffer.readUInt8(offset);
    offset += 1;

    // ハッシュ値
    let hashValue = undefined;
    if (existHashValue === 1) {
      hashValue = this.buffer.readUInt32BE(offset);
      offset += 4;
    }

    return { name, childCount, offset, nodeSize, hashValue };
  }

  traverseToLeaf({
    target,
    partialMatch = false,
    extraChallenges,
  }: {
    target: CharNode;
    partialMatch: boolean;
    extraChallenges: string[];
  }) {

    // ルートノードは空文字なので、それにヒットさせるためのDummyHead
    const dummyHead = new CharNode({
      originalChar: '',
      char: '',
    });
    dummyHead!.next = target;

    // 結果を保存するためのFileTrieResults
    const results = new FileTrieResults();

    // 探索キュー
    let head: ITraverse | undefined = {
      // 正確にマッチした文字数
      matchedCnt: 0,

      // ?やextraChallengeでマッチした文字数
      ambigousCnt: 0,

      // 検索する文字列
      target: dummyHead,

      // ファイルヘッダーの直後から探索を始める
      currentOffset: this.headerSize,

      // マッチしすぎるときがあるので、partialMatch = trueのときは
      // 最後にマッチしたノードの1つ前にマッチしたノードを含めて返す
      lastPartialMatch: undefined,

      // マッチした文字のパス（デバッグ用）
      path: "",

      // 探索条件が検索するべきノード領域の範囲
      bounce: this.dataRegionOffset,

      // extraChallengeをするか（一度したら、二回目はない)
      allowExtraChallenge: extraChallenges.length > 0,

      next: undefined,
    };

    // 連結配列の末尾
    let tail = head;

    // キューが空になるまで探索を行う
    while (head) {
      // オフセット値が適切にセットされていなければスキップ (コードとしては起こり得ないが、予防策)
      let currentOffset = head.currentOffset;
      if (!currentOffset) {
        head = head.next;
        continue
      }
      let target = head.target;
      let ambigousCnt = head.ambigousCnt;
      let matchedCnt = head.matchedCnt;
      let path = head.path;
      let dataBounce = head.bounce;
      let allowExtraChallenge = head.allowExtraChallenge;
      while (target && currentOffset < dataBounce) {
        // 現在のノード（currentOffset）の情報を読取る
        const { name, offset, nodeSize, hashValue } = this.readNode(currentOffset);
        
        if (target?.char !== DEFAULT_FUZZY_CHAR && target?.char !== name) {
          // allowExtraChallengeがある場合は、その文字にマッチするものがあればキューに追加する
          if (allowExtraChallenge) {
            for (const extraWord of extraChallenges) {
              if (extraWord[0] !== name) {
                continue;
              }

              const extraNode = CharNode.create(extraWord);
              let extraTail = extraNode?.next;
              while (extraTail!.next) {
                extraTail = extraTail!.next;
              }
              extraTail!.next = target.clone();

              const notMatched = {
                ambigousCnt: ambigousCnt + extraWord.length,
                matchedCnt,
                target: extraNode,
                currentOffset: currentOffset,
                partialMatches: head.lastPartialMatch,
                path,
                bounce: dataBounce,
                allowExtraChallenge: false,
                next: undefined,
              };
              tail.next = notMatched;
              tail = tail.next;
            }

          }
          // 文字がマッチしない場合は、ノードのサイズ分だけスキップして次のノードに進む
          currentOffset += nodeSize;
          continue;
        }

        // ワイルドカードだった場合はマッチしなかった場合と、マッチした場合の2つに分岐する
        if (target?.char === DEFAULT_FUZZY_CHAR) {
          const notMatched = {
            ambigousCnt,
            matchedCnt,
            target: target.clone(),
            currentOffset: currentOffset + nodeSize,
            partialMatches: head.lastPartialMatch,
            path,
            bounce: dataBounce,
            allowExtraChallenge,
            next: undefined,
          };
          tail.next = notMatched;
          tail = tail.next;
          ambigousCnt++;
        }
        path += target.char;

        // マッチした文字数のインクリメント
        matchedCnt++;

        // リーフノードに到達
        if (!target.next) {
          if (!hashValue) {
            break;
          }

          // 保存する
          results.add({
            matchedCnt,
            ambigousCnt,
            hashValue,
            target: target.next,
            currentOffset: currentOffset!,
            path,
            bounce: dataBounce,
            next: undefined,
          });
          if (partialMatch && head.lastPartialMatch) {
            results.add(head.lastPartialMatch);
          }
          break;
        }

        // partialMatch = trueのときは、途中結果も保存する
        if (partialMatch && hashValue) {
          head.lastPartialMatch = {
            matchedCnt,
            ambigousCnt,
            hashValue,
            target: target.next,
            currentOffset,
            path,
            bounce: dataBounce,
            next: undefined,
          };
        }
        
        // 文字ポインターを移動させる
        target = target.next;

        // 探索の範囲を狭めていく
        dataBounce = currentOffset + nodeSize;
 
        // 一致するノードが見つかった場合、そのノードのオフセットに移動して次の階層へ
        currentOffset = offset;
      }
      head = head.next;
    }
    return Array.from(results.values()).filter(x => x.hashValue);
  }

  getDataByHash(hashValue: number) {
    // データ領域の正確な開始オフセット
    let offset = this.dataRegionOffset;

    while (offset < this.buffer.length) {
      const currentHash = this.buffer.readUInt32BE(offset);
      offset += 4;

      const dictLength = this.buffer.readUInt32BE(offset);
      offset += 4;

      const dictString = this.buffer.toString('utf8', offset, offset + dictLength);
      offset += dictLength;

      // 現在のハッシュが探索しているハッシュ値に一致するかをチェック
      if (currentHash === hashValue) {
        return JSON.parse(dictString);
      }
    }
    return null; // ハッシュ値が見つからない場合
  }
}

// ファイル読み込みと探索実行
fs.readFile(`src/usecases/geocode/models/trie/test-with-paging.bin`, (err, data) => {
  if (err) throw err;

  const fileTrieReader = new FileTrieReader(data);
  const target = "静岡県沼津市岡485-6";
  const leafNodes = fileTrieReader.traverseToLeaf({
    target: CharNode.create(target)!,
    partialMatch: true,
    extraChallenges: ['市', '一色']
  });

  if (leafNodes && leafNodes.length > 0) {
    console.log('---')
    leafNodes.forEach(node => {
      if (!node.hashValue) {
        return;
      }
      const data = fileTrieReader.getDataByHash(node.hashValue);
      console.log({
        ...data,
        node,
      })
      // const originalData = convertToOriginalFields(data, reverseFieldMapping);
      // console.log({
      //   ...originalData,
      //   node,
      // });
    })
  } else {
    console.log('Leaf node not found');
  }
});
