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
import { BEGIN_SPECIAL, DASH, DASH_SYMBOLS, DEFAULT_FUZZY_CHAR, DOUBLE_QUOTATION, END_SPECIAL, J_DASH, MUBANCHI, NUMRIC_AND_KANJI_SYMBOLS, NUMRIC_SYMBOLS, OAZA_BANCHO, SINGLE_QUOTATION, SPACE, SPACE_CHARS, SPACE_SYMBOLS, VIRTUAL_SPACE, ZENKAKU } from '@config/constant-values';
import { DebugLogger } from '@domain/services/logger/debug-logger';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { Transform, TransformCallback } from 'node:stream';
import { Query, QueryInput } from '../models/query';
import { jisKanjiForCharNode } from '../services/jis-kanji';
import { kan2numForCharNode } from '../services/kan2num';
import { toHankakuAlphaNumForCharNode } from '../services/to-hankaku-alpha-num';
import { toHiraganaForCharNode } from '../services/to-hiragana';
import { CharNode } from '../services/trie/char-node';
import { QuerySet } from '../models/query-set';
import { toKatakanaForCharNode } from '../services/to-katakana';

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

    // アラビア数字の直後に全角が来る場合は、仮想のスペース記号を入れる
    // (〇〇番地32三田マンション　のように、「2」の直後に「三」が来た場合に区切りをつけるため)
    // address = address?.replace(
    //   RegExpEx.create(
    //     `(${NUMRIC_SYMBOLS})(${ZENKAKU})`,
    //     'g',
    //   ),
    //   `$1${VIRTUAL_SPACE}$2`
    // );

    // 数字＋ダッシュ　または ダッシュ+数字　の組み合わせのとき、ダッシュを DASHにする
    // (ダッシュの記号は類似するものが多いので、統一する)
    address = address?.replace(
      RegExpEx.create(
        `([${NUMRIC_AND_KANJI_SYMBOLS}][${DASH_SYMBOLS}])|([${DASH_SYMBOLS}])([${NUMRIC_AND_KANJI_SYMBOLS}])`,
        'g'
      ),
      (match: string) => {
        return match.replace(RegExpEx.create(`[${DASH_SYMBOLS}]`, 'g'), DASH);
      },
    );

    // 〇〇町や〇〇番地　より前にある SPACEはすべて削除
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
    
    // 大字が「番町」の場合があるので、置換する
    address = address?.replace(RegExpEx.create('(高松市|岡山市北区|北区)番町', 'g'), `$1${OAZA_BANCHO}`);

    // 漢数字 => 算用数字
    address = kan2numForCharNode(address);

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
    address = replaceBancho(address);

    // 「〇〇番地〇〇号」の「号」を DASH にする
    // 「〇〇号室」「〇〇号棟」「〇〇号区」「〇〇F」「〇〇階」は変換しない
    address = address?.replaceAll(RegExpEx.create(`(${DASH}[0-9]+)号(?![室棟区館階])`, 'g'), '$1');

    // this.params.logger?.info(`normalize : ${((Date.now() - query.startTime) / 1000).toFixed(2)} s`);
    const results = new QuerySet();
    results.add(query.copy({
      tempAddress: address,
    }));
    callback(null, results);
  }
}

const replaceBancho = (address: CharNode | undefined): CharNode | undefined => {
  let slow: CharNode | undefined = address;

  const stack: (CharNode | undefined)[] = [];
  let slowNext: CharNode | undefined;
  while (slow) {
    if (!slow.ignore && slow.char && RegExpEx.create('[0-9]').test(slow.char)) {
      const tmp = charNodeToString(stack) + slow.char;
      if (RegExpEx.create('([0-9]+)番[丁地街町][の目]?([0-9]+)').test(tmp)) {
        while (!RegExpEx.create('[0-9]').test(stack.at(-1)?.char || '')) {
          stack.pop();
        }
        stack.push(CharNode.create(DASH));
      }
    }
    slowNext = slow.next;
    slow.next = undefined;
    stack.push(slow);
    slow = slowNext;
  }

  const tmp = charNodeToString(stack);
  if (RegExpEx.create('([0-9]+)番[丁地街町][の目]?').test(tmp)) {
    while (!RegExpEx.create('[0-9]').test(stack.at(-1)?.char || '')) {
      stack.pop()
    }
  }

  const head: CharNode | undefined = new CharNode('', '');
  let tail: CharNode | undefined = head;
  for (const node of stack) {
    tail!.next = node;
    tail = tail?.next;
  }

  return head.next;
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
  const [before, ...after] = address.split(RegExpEx.create(`[${VIRTUAL_SPACE}${SPACE}]`, 'g'));

  const kanjiNums = RegExpEx.create('[壱一二ニ弐参三四五六七八九零十]');
  const mathNums = RegExpEx.create('[0-9]');

  const normalized = ((p) => {
    if (!p) {
      return;
    }
    let slow: CharNode | undefined = p;
    let fast: CharNode | undefined = p.next;
    while (slow && fast) {
      slow = slow.moveToNext();
      if (slow?.char === BEGIN_SPECIAL) {
        // move the pointer until END_SPECIAL
        slow = slow?.next?.moveToNext(END_SPECIAL);
      }

      fast = slow?.next?.moveToNext();
      if (fast?.char === BEGIN_SPECIAL) {
        // move the pointer until END_SPECIAL
        fast = fast?.next?.moveToNext(END_SPECIAL);
      }
      if (!slow || !fast) {
        break;
      }
      
      // 算用数字と漢数字の間にスペースを入れる
      if (mathNums.test(slow.originalChar!) && kanjiNums.test(fast.originalChar!)) {
        slow = slow.moveToNext();
        slow!.next = new CharNode(SPACE, SPACE);
        slow!.next.next = fast;
        break;
      }

      // 12-34-56号室のとき、4-5の間のDashをスペースに置き換える
      // https://github.com/digital-go-jp/abr-geocoder/issues/157
      if (mathNums.test(slow.char!) && fast.char === DASH) {
        slow = fast;
        fast = fast.next?.moveToNext();
        if (!fast) {
          break;
        }
        if (mathNums.test(fast.char!)) {
          let another: CharNode | undefined = fast;
          while (another && (another.ignore || mathNums.test(another.char!))) {
            another = another.next;
          }
          if (another) {
            // 建物の階層：2階, 2F
            // 部屋番号：2号室, 302号室, 2A / 3B
            // 建物の棟番号：2号棟 / A棟 / 1番館
            if (RegExpEx.create('[番階号棟A-Z]').test(another.char!)) {
              slow.char = SPACE;
              slow.originalChar = SPACE;
              break;
            } else if (!RegExpEx.create(`[${SPACE}${VIRTUAL_SPACE}${DASH}]`).test(another.char!)) {
              // 12-23-34南館 の場合、4と南の間にスペースを入れる
              fast = fast.moveToNext();
              fast!.next = new CharNode(SPACE, SPACE);
              fast!.next.next = another;
              break;
            }
          }
        }
      }
      slow = slow?.next?.moveToNext();
      fast = slow?.next?.moveToNext();
    }
    return p;
  })(before);

  // 結合する
  const result = CharNode.joinWith(new CharNode(SPACE), normalized, ...after);
  return result;
}