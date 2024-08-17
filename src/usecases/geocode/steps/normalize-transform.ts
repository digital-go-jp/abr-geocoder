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
import { DASH, DASH_SYMBOLS, DEFAULT_FUZZY_CHAR, DOUBLE_QUOTATION, J_DASH, KANJI_NUMS, MUBANCHI, NUMRIC_AND_KANJI_SYMBOLS, OAZA_BANCHO, SINGLE_QUOTATION, SPACE, SPACE_CHARS, SPACE_SYMBOLS } from '@config/constant-values';
import { DebugLogger } from '@domain/services/logger/debug-logger';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { Transform, TransformCallback } from 'node:stream';
import { Query, QueryInput } from '../models/query';
import { QuerySet } from '../models/query-set';
import { isDigitForCharNode } from '../services/is-number';
import { jisKanjiForCharNode } from '../services/jis-kanji';
import { kan2numForCharNode } from '../services/kan2num';
import { toHankakuAlphaNumForCharNode } from '../services/to-hankaku-alpha-num';
import { toHiraganaForCharNode } from '../services/to-hiragana';
import { CharNode } from '../services/trie/char-node';

export class NormalizeTransform extends Transform {

  constructor(private params: {
    logger?: DebugLogger;
  }) {
    super({
      objectMode: true,
    });
  }

  _transform(
    input: QueryInput,
    _: BufferEncoding,
    callback: TransformCallback
  ): void {
    
    // Unicode正規化を行う
    // https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
    input.data.address = input.data.address.normalize('NFC');

    // 重複する空白をまとめる
    input.data.address = input.data.address.replaceAll(RegExpEx.create(' +', 'g'), ' ');

    // カッコを半角にする
    input.data.address = input.data.address.replaceAll('（', '(');
    input.data.address = input.data.address.replaceAll('）', ')');

    const query = Query.create(input);
    
    let address : CharNode | undefined = query.tempAddress;

    if (input.data.fuzzy) {
      address = address?.replaceAll(input.data.fuzzy, DEFAULT_FUZZY_CHAR);
    }

    // 日本語の漢字、ひらがな、カタカナ、全角アルファベット、全角数字、全角記号を残し
    // 文字化け、絵文字などの非標準文字を Fuzzy に変換する
    // U+0000～U+007F: US-ASCII と同一
    // U+2000～U+206F: 一般句読点
    // U+2212: 数学演算子の "−"
    // U+2500～U+257F: 罫線素片
    // U+3000～U+303F: 句読点等
    // U+3040～U+309F: 平仮名、濁点・半濁点
    // U+30A0～U+30FF: 片仮名
    // U+3400～U+4DBF: 拡張漢字
    // U+4E00～U+9FFC: 漢字
    // U+F900～U+FAFF: IBM拡張漢字、拡張漢字
    // U+FF00～U+FFEF: 半角片仮名、全角英数字等
    address = address?.replaceAll(
      RegExpEx.create(`[^${DEFAULT_FUZZY_CHAR}\u0020-\u007E\u2000-\u206F\u2212\u2500-\u257F\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]+`, 'g'),
      DEFAULT_FUZZY_CHAR,
    );

    //
    // 入力された住所に対して以下の正規化を予め行う。
    //
    // 1. 全角のアラビア英数字（０-９Ａ-Ｚａ-ｚ）を半角英数字(0-9A-Za-z)に置換する
    // 2. 全角スペースを半角スペースに変換s
    // 3. 最初に出てくる `1-` や `五-` のような文字列を町丁目とみなして、それ以前のスペースをすべて削除する。
    //
    // オリジナルコード
    // https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L271-L294
    //

    // クォーテーションマークがあれば、削除する。
    address = address?.replaceAll(SINGLE_QUOTATION, '');
    address = address?.replaceAll(DOUBLE_QUOTATION, '');

    // 空白記号(半角・全角)は、SPACEに置換
    address = address?.replaceAll(
      RegExpEx.create(`[${SPACE_CHARS}]+`, 'g'),
      SPACE,
    );
    
    // 英数字を半角にする
    address = toHankakuAlphaNumForCharNode(address);

    // 数字＋ダッシュ または ダッシュ+数字 の組み合わせのとき、ダッシュを DASHにする
    // (ダッシュの記号は類似するものが多いので、統一する)
    address = address?.replaceAll(
      RegExpEx.create(
        `([${NUMRIC_AND_KANJI_SYMBOLS}][${DASH_SYMBOLS}])|([${DASH_SYMBOLS}][${NUMRIC_AND_KANJI_SYMBOLS}])`,
        'g'
      ),
      (match: string) => {
        return match.replace(RegExpEx.create(`[${DASH_SYMBOLS}]`, 'g'), DASH);
      },
    );

    // 〇〇町や〇〇番地 より前にある SPACEはすべて削除
    address = address?.replace(
      RegExpEx.create(`(.+)(丁目?|番(町|地|丁)|条|軒|線|(${J_DASH})町|地割)`),
      (match: string) => {
        return match.replace(RegExpEx.create(`[${SPACE_SYMBOLS}]`, 'g'), '');
      }
    );

    // 半角カナ・全角カナ => 平仮名
    address = toHiraganaForCharNode(address);

    // 全角英数字は、半角英数字に変換
    address = toHankakuAlphaNumForCharNode(address);
    
    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanjiForCharNode(address);

    // DBに島の名前が入っていないので、消しておく
    address = address?.replace('八丈島', '');
    address = address?.replace('三宅島', '');
    
    // 漢数字 => 算用数字
    address = kan2numForCharNode(address);

    // 大字が「番町」の場合があるので、置換する
    // address = address?.replace(RegExpEx.create('(高松市|岡山市北区|北区)番町', 'g'), `$1${OAZA_BANCHO}`);
    address = address?.replace(RegExpEx.create('番町', 'g'), OAZA_BANCHO);

    // カッコで括られている範囲は住所にならないので無視する
    address = ignoreParenthesis(address);

    // 12-34-56号室 や 12-34-5号棟 の場合、4-5の間の DASH をスペースに置換する
    address = insertSpaceBeforeRoomOrFacility(address);
    
    // 「大字」「字」を削除する
    address = address?.replaceAll(RegExpEx.create('大?字', 'g'), '');

    // 「無番地」を「MUBANCHI」にする
    address = address?.replace(RegExpEx.create('無番地'), MUBANCHI);

    // 「番地」「番丁」「番町」「番街」「番」「番地の」をDASHにする
    // address = address?.replaceAll(RegExpEx.create('([0-9]+)番[丁地街町][の目]?([0-9]+)', 'g'), `$1${DASH}$2`);
    // address = address?.replaceAll(RegExpEx.create('([0-9]+)番[の目]?([0-9]+)', 'g'), `$1${DASH}$2`);
    // address = address?.replaceAll(RegExpEx.create('([0-9]+)番[丁地街町]', 'g'), '$1');
    address = replaceBanchome(address);

    // 「〇〇番地〇〇号」の「号」を DASH にする
    // 「〇〇号室」「〇〇号棟」「〇〇号区」「〇〇F」「〇〇階」は変換しない
    // address = address?.replaceAll(RegExpEx.create(`(${DASH}[0-9]+)号(?![室棟区館階])`, 'g'), '$1');

    // this.params.logger?.info(`normalize : ${((Date.now() - query.startTime) / 1000).toFixed(2)} s`);
    const results = new QuerySet();
    results.add(query.copy({
      tempAddress: address,
    }));
    callback(null, results);
  }
}

const replaceBanchome = (address: CharNode | undefined): CharNode | undefined => {
  let pointer: CharNode | undefined = address;

  const stack: (CharNode | undefined)[] = [];
  let skipPush: boolean = false;
  while (pointer) {
    if (pointer.ignore) {
      const pNext = pointer.next;
      pointer.next = undefined;
      stack.push(pointer);
      pointer = pNext;
      continue;
    }
    skipPush = false;

    const tmp = charNodeToString(stack) + pointer.char;
    const nextPointer = pointer.next?.moveToNext();
    switch (true) {
      case isDigitForCharNode(pointer): {
        // 1番地999, 2番丁999, 3番街999, 4番町999, 5丁目999, 55線86番地
        if (RegExpEx.create('([0-9]+)番[丁地街][の目]?([0-9]+)$').test(tmp) ||
            RegExpEx.create('([0-9]+)丁目?([0-9]+)$').test(tmp) ||
            RegExpEx.create('([0-9]+)番[丁地街]?([0-9]+)$').test(tmp) ||
            RegExpEx.create('([0-9]+)[条通]([0-9]+)$').test(tmp) ||
            RegExpEx.create('([0-9]+)の?通りの?([0-9]+)$').test(tmp) ||
            RegExpEx.create('([0-9]+)の町([0-9]+)$').test(tmp) ||
            RegExpEx.create('([0-9]+)線([0-9]+)$').test(tmp)) {
          
          const buffer: string[] = [];
          while (!isDigitForCharNode(stack.at(-1))) {
            const removed = stack.pop();
            if (removed && removed.originalChar) {
              buffer.push(removed.originalChar);
            }
          }
          stack.push(new CharNode({
            char: DASH,
            originalChar: buffer.reverse().join(''),
          }));
        }
        break;
      }

      case RegExpEx.create('[0-9][条通線][東西南北]$').test(tmp): {
        // 「条」を取る
        const removed = stack.pop();

        // DASHにする
        stack.push(new CharNode({
          char: DASH,
          originalChar: removed?.originalChar,
        }));
        break;
      }

      // 番地の + (数字) の場合
      case RegExpEx.create('番地[の目]$').test(tmp) && nextPointer && isDigitForCharNode(nextPointer): {
        // 「番地」を取る
        stack.pop();
        stack.pop();
        // DASHを入れる
        stack.push(new CharNode({
          char: DASH,
          originalChar: '番地',
        }));
        skipPush = true;
        break;
      }
      // 番地 + (数字) の場合
      case tmp.endsWith('番地') && nextPointer && isDigitForCharNode(nextPointer): {
        // 「番」を取る
        stack.pop();
        // DASHを入れる
        stack.push(new CharNode({
          char: DASH,
          originalChar: '番地',
        }));
        skipPush = true;
        break;
      }
      // (数字) + 番 + (数字) の場合
      case isDigitForCharNode(stack.at(-1)) && 
        tmp.endsWith('番') &&
        nextPointer && isDigitForCharNode(nextPointer):
      {
        // DASHを入れる
        stack.push(new CharNode({
          char: DASH,
          originalChar: pointer.char,
        }));
        skipPush = true;
        break;
      }
      // 番地 + (数字以外) の場合
      case tmp.endsWith('番地') && nextPointer && !isDigitForCharNode(nextPointer) && !RegExpEx.create('[の目]').test(nextPointer?.char || ''): {
        // 「番」を取る
        stack.pop();
        // スペースを入れる
        stack.push(new CharNode({
          char: SPACE,
          originalChar: '番地',
        }));
        skipPush = true;
        break;
      }

      case RegExpEx.create('[0-9]の[0-9]$').test(tmp): {
        // 「の」を取る
        stack.pop()
        // DASHを入れる
        stack.push(CharNode.create(DASH));
        break;
      }
      default:
        break;
    }

    const pNext = pointer.next;
    pointer.next = undefined;
    if (!skipPush) {
      stack.push(pointer);
    }
    pointer = pNext;
  }

  const tmp = charNodeToString(stack);
  if (RegExpEx.create('([0-9]+)[番号線][丁地街町]?(?![室棟館])$').test(tmp)) {
    while (!isDigitForCharNode(stack.at(-1))) {
      stack.pop()
    }
  }

  const head: CharNode | undefined = new CharNode({
    char: '',
  });
  let tail: CharNode | undefined = head;
  for (const node of stack) {
    tail!.next = node;
    tail = tail?.next;
  }

  return head.next;
};

const ignoreParenthesis = (address: CharNode| undefined): CharNode | undefined => {
  let pointer: CharNode | undefined = address;
  const parenthesis: Map<string | undefined, string> = new Map([
    ['(', ')'],
    ['(', ')'],
    ['「', '」'],
    ['[', ']'],
    ['『', '』'],
  ]);

  const buffer: string[] = [];
  while (pointer) {
    if (pointer.ignore) {
      pointer = pointer.next;
      continue;
    }

    if (pointer.char === '（') {
      pointer.char = '(';
    }
    if (pointer.char === '）') {
      pointer.char = ')';
    }
    if (parenthesis.has(pointer.char)) {
      buffer.push(parenthesis.get(pointer.char)!)
      pointer.ignore = true;
    } else if (pointer.char === buffer.at(-1)) {
      pointer.ignore = true;
      buffer.pop();
    } else {
      pointer.ignore = buffer.length !== 0;
    }
    pointer = pointer.next;
  }
  return address;
};
const charNodeToString = (stack: (CharNode | undefined)[]): string => {
  const buffer: string[] = [];
  for (const node of stack) {
    buffer.push(node?.char || '');
  }
  return buffer.join('');
}

const insertSpaceBeforeRoomOrFacility = (address: CharNode | undefined): CharNode | undefined => {
  if (!address) {
    return;
  }

  // 最初に空白がある位置より前と後に分ける
  const [before, ...after] = address.split(RegExpEx.create(SPACE, 'g'));

  const kanjiNums = RegExpEx.create(`[${KANJI_NUMS}]`);

  const stack: CharNode[] = before.split('');
  const head: CharNode = new CharNode({
    char: '',
  });
  let top: CharNode;
  while (stack.length > 0) {
    top = stack.pop()!;
    if (top.ignore || !top.char) {
      top.next = head.next;
      head.next = top;
      continue;
    }
    
    // (数字) + 「の」+ (数字」)の場合、「の」をDASHにする
    if (
      (
        kanjiNums.test(stack.at(-2)?.originalChar || '') ||
        isDigitForCharNode(stack.at(-2))
      ) &&
      RegExpEx.create('[のノ丿之]').test(stack.at(-1)?.char || '') &&
      (
        kanjiNums.test(top?.originalChar || '') ||
        isDigitForCharNode(top)
      )
    ) {
      // 「の」を取る
      const removed = stack.pop();
      // DASHにする
      const dash = new CharNode({
        char: DASH,
        originalChar: removed?.originalChar,
      });
      top.next = head.next;
      dash.next = top;
      head.next = dash;
      continue;
    }

    // 算用数字と漢数字の間にスペースを入れる
    if (isDigitForCharNode(top) && !kanjiNums.test(top.originalChar!) &&
      kanjiNums.test(head.next?.moveToNext()?.originalChar || '')) {
    // if (
    //   !RegExpEx.create(`[${DASH}${SPACE}]`).test(stack.at(-1)?.char || '') &&
    //   isDigitForCharNode(top) && !kanjiNums.test(top.originalChar!) &&
    //   !RegExpEx.create(`[号番通条線町街丁階F${DASH}${SPACE}]`).test(head.next?.moveToNext()?.char || '') &&
    //   (!isDigitForCharNode(head.next?.moveToNext()) || kanjiNums.test(head.next?.moveToNext()?.originalChar || ''))) {
      const space = new CharNode({
        char: SPACE,
      });
      space.next = head.next?.moveToNext();
      top.next = space;
      head.next = top;
      continue;
    }

    // 12-34-56号室のとき、4-5の間のDashをスペースに置き換える
    // https://github.com/digital-go-jp/abr-geocoder/issues/157
    if (isDigitForCharNode(stack.at(-1)) && top.char === '号' && head.next?.char === '室') {
      // 号を headにつなげる
      top.next = head.next;
      head.next = top;
      // 数字を headにつなげる
      while (isDigitForCharNode(stack.at(-1))) {
        const num = stack.pop()!;
        num.next = head.next;
        head.next = num;
      }
      const buffer: string[] = [];
      while (RegExpEx.create(`[号番通条${DASH}${SPACE}]`).test(stack.at(-1)?.char || '')) {
        const removed = stack.pop();
        if (removed && removed.originalChar) {
          buffer.push(removed.originalChar);
        }
      }
      const space = new CharNode({
        char: SPACE,
        originalChar: buffer.reverse().join(''),
      });
      space.next = head.next;
      head.next = space;
      continue;
    }

    top.next = head.next;
    head.next = top;
  }

  // 結合する
  const separator = new CharNode({
    char: SPACE,
  });
  const result = CharNode.joinWith(separator, head.next, ...after);
  return result;
}
