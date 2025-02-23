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

import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { TrieAddressFinder } from "../models/trie/trie-finder";

/*
 * JIS 第2水準 => 第1水準 及び 旧字体 => 新字体、及び
 * 間違えやすい漢字（例：川崎と川﨑）を変換する。
 * トライ木の検索キーと、クエリの住所文字列の両方が
 * 同じ漢字になっていればマッチする。
 * トライ木には本来の漢字表記が入っているので、
 * このシステムでは問題ない。
 */
const kanji_table: string[][] = [
  ['淵', '渕'],
  ['曾', '会'],
  ['亞', '亜'],
  ['圍', '囲'],
  ['壹', '壱'],
  ['榮', '栄'],
  ['驛', '駅'],
  ['應', '応'],
  ['櫻', '桜'],
  ['假', '仮'],
  ['會', '会'],
  ['懷', '懐'],
  ['覺', '覚'],
  ['樂', '楽'],
  ['陷', '陥'],
  ['歡', '歓'],
  ['氣', '気'],
  ['戲', '戯'],
  ['據', '拠'],
  ['挾', '挟'],
  ['區', '区'],
  ['徑', '径'],
  ['溪', '渓'],
  ['輕', '軽'],
  ['藝', '芸'],
  ['儉', '倹'],
  ['圈', '圏'],
  ['權', '権'],
  ['嚴', '厳'],
  ['恆', '恒'],
  ['國', '国'],
  ['齋', '斎'],
  ['雜', '雑'],
  ['蠶', '蚕'],
  ['殘', '残'],
  ['兒', '児'],
  ['實', '実'],
  ['釋', '釈'],
  ['從', '従'],
  ['縱', '縦'],
  ['敍', '叙'],
  ['燒', '焼'],
  ['條', '条'],
  ['剩', '剰'],
  ['壤', '壌'],
  ['釀', '醸'],
  ['眞', '真'],
  ['盡', '尽'],
  ['醉', '酔'],
  ['髓', '髄'],
  ['聲', '声'],
  ['竊', '窃'],
  ['淺', '浅'],
  ['錢', '銭'],
  ['禪', '禅'],
  ['爭', '争'],
  ['插', '挿'],
  ['騷', '騒'],
  ['屬', '属'],
  ['對', '対'],
  ['滯', '滞'],
  ['擇', '択'],
  ['單', '単'],
  ['斷', '断'],
  ['癡', '痴'],
  ['鑄', '鋳'],
  ['敕', '勅'],
  ['鐵', '鉄'],
  ['傳', '伝'],
  ['黨', '党'],
  ['鬪', '闘'],
  ['屆', '届'],
  ['腦', '脳'],
  ['廢', '廃'],
  ['發', '発'],
  ['蠻', '蛮'],
  ['拂', '払'],
  ['邊', '辺'],
  ['瓣', '弁'],
  ['寶', '宝'],
  ['沒', '没'],
  ['滿', '満'],
  ['藥', '薬'],
  ['餘', '余'],
  ['樣', '様'],
  ['亂', '乱'],
  ['兩', '両'],
  ['禮', '礼'],
  ['靈', '霊'],
  ['爐', '炉'],
  ['灣', '湾'],
  ['惡', '悪'],
  ['醫', '医'],
  ['飮', '飲'],
  ['營', '営'],
  ['圓', '円'],
  ['歐', '欧'],
  ['奧', '奥'],
  ['價', '価'],
  ['繪', '絵'],
  ['擴', '拡'],
  ['學', '学'],
  ['罐', '缶'],
  ['勸', '勧'],
  ['觀', '観'],
  ['歸', '帰'],
  ['犧', '犠'],
  ['擧', '挙'],
  ['狹', '狭'],
  ['驅', '駆'],
  ['莖', '茎'],
  ['經', '経'],
  ['繼', '継'],
  ['缺', '欠'],
  ['劍', '剣'],
  ['檢', '検'],
  ['顯', '顕'],
  ['廣', '広'],
  ['鑛', '鉱'],
  ['碎', '砕'],
  ['劑', '剤'],
  ['參', '参'],
  ['慘', '惨'],
  ['絲', '糸'],
  ['辭', '辞'],
  ['舍', '舎'],
  ['壽', '寿'],
  ['澁', '渋'],
  ['肅', '粛'],
  ['將', '将'],
  ['證', '証'],
  ['乘', '乗'],
  ['疊', '畳'],
  ['孃', '嬢'],
  ['觸', '触'],
  ['寢', '寝'],
  ['圖', '図'],
  ['穗', '穂'],
  ['樞', '枢'], // 樞ヶ谷
  ['齊', '斉'],
  ['攝', '摂'],
  ['戰', '戦'],
  ['潛', '潜'],
  ['雙', '双'],
  ['莊', '荘'],
  ['裝', '装'],
  ['藏', '蔵'],
  ['續', '続'],
  ['體', '体'],
  ['臺', '台'],
  ['澤', '沢'],
  ['膽', '胆'],
  ['彈', '弾'],
  ['蟲', '虫'],
  ['廳', '庁'],
  ['鎭', '鎮'],
  ['點', '点'],
  ['燈', '灯'],
  ['盜', '盗'],
  ['獨', '独'],
  ['貳', '弐'],
  ['霸', '覇'],
  ['賣', '売'],
  ['髮', '髪'],
  ['祕', '秘'],
  ['佛', '仏'],
  ['變', '変'],
  ['辯', '弁'],
  ['豐', '豊'],
  ['飜', '翻'],
  ['默', '黙'],
  ['與', '与'],
  ['譽', '誉'],
  ['謠', '謡'],
  ['覽', '覧'],
  ['獵', '猟'],
  ['勵', '励'],
  ['齡', '齢'],
  ['勞', '労'],
  ['壓', '圧'],
  ['爲', '為'],
  ['隱', '隠'],
  ['衞', '衛'],
  ['鹽', '塩'],
  ['毆', '殴'],
  ['穩', '穏'],
  ['畫', '画'],
  ['壞', '壊'],
  ['殼', '殻'],
  ['嶽', '岳'],
  ['卷', '巻'],
  ['關', '関'],
  ['顏', '顔'],
  ['僞', '偽'],
  ['舊', '旧'],
  ['峽', '峡'],
  ['曉', '暁'],
  ['勳', '勲'],
  ['惠', '恵'],
  ['螢', '蛍'],
  ['鷄', '鶏'], // 鬪雞神社
  ['雞', '鶏'], // 鬪雞神社
  ['縣', '県'],
  ['險', '険'],
  ['獻', '献'],
  ['驗', '験'],
  ['效', '効'], // 效範町一丁目
  ['號', '号'],
  ['濟', '済'],
  ['册', '冊'],
  ['棧', '桟'],
  ['贊', '賛'],
  ['齒', '歯'],
  ['濕', '湿'],
  ['寫', '写'],
  ['收', '収'],
  ['獸', '獣'],
  ['處', '処'],
  ['稱', '称'], // 桜井総稱鬼泪山
  ['奬', '奨'],
  ['淨', '浄'],
  ['繩', '縄'],
  ['讓', '譲'],
  ['囑', '嘱'],
  ['愼', '慎'],
  ['粹', '粋'],
  ['隨', '随'],
  ['數', '数'],
  ['靜', '静'],
  ['專', '専'],
  ['踐', '践'],
  ['纖', '繊'],
  ['壯', '壮'],
  ['搜', '捜'],
  ['總', '総'],
  ['臟', '臓'],
  ['墮', '堕'],
  ['帶', '帯'],
  ['瀧', '滝'],
  ['擔', '担'],
  ['團', '団'],
  ['遲', '遅'],
  ['晝', '昼'],
  ['聽', '聴'],
  ['遞', '逓'],
  ['轉', '転'],
  ['當', '当'],
  ['稻', '稲'],
  ['讀', '読'],
  ['惱', '悩'],
  ['拜', '拝'],
  ['麥', '麦'],
  ['拔', '抜'],
  ['濱', '浜'],
  ['竝', '並'],
  ['辨', '弁'],
  ['舖', '舗'],
  ['襃', '褒'],
  ['萬', '万'],
  ['譯', '訳'],
  ['豫', '予'],
  ['搖', '揺'],
  ['來', '来'],
  ['龍', '竜'],
  ['壘', '塁'],
  ['隸', '隷'],
  ['戀', '恋'],
  ['樓', '楼'],
  ['鰺', '鯵'],
  ['鶯', '鴬'],
  ['蠣', '蛎'],
  ['攪', '撹'],
  ['竈', '竃'],
  ['灌', '潅'],
  ['諫', '諌'],
  ['頸', '頚'],
  ['礦', '砿'],
  ['蘂', '蕊'],
  ['靱', '靭'],
  ['賤', '賎'],
  ['壺', '壷'],
  ['礪', '砺'],
  ['檮', '梼'],
  ['濤', '涛'],
  ['邇', '迩'],
  ['蠅', '蝿'],
  ['檜', '桧'],
  ['儘', '侭'],
  ['藪', '薮'],
  ['籠', '篭'],
  ['彌', '弥'],
  ['萩', '荻'],
  ['蘒', '荻'], // 蘒之瀬
  ['磐', '盤'],
  ['秦', '奏'],
  ['﨑', '崎'],
  ['埴', '植'],
  ['塚', '塚'],
  ['糀', '麹'],  // 糀町
  ['麴', '麹'],  // 麹町
  ['都', '都'],  // 宇都宮
  ['神', '神'],
  ['侮', '侮'],
  ['靖', '靖'],
  ['﨣', '啓'],
  ['羽', '羽'],
  ['海', '海'],
  ['渚', '渚'],
  ['﨔', '奄'],
  ['祉', '祉'],
  ['祖', '祖'],
  ['祝', '祝'],
  ['嘆', '嘆'],
  ['琢', '琢'],
  ['碑', '碑'],
  ['社', '社'],
  ['祈', '祈'],
  ['祐', '祐'],
  ['穀', '穀'],
  ['椴', '椵'], // 椵川町
  ['犹', '犾'], // 犾森
  ['炮', '砲'], // 鉄砲
  ['脵', '又'], // 長山北ノ又沢
  ['㯃', '漆'], // 漆野
  ['椊', '枠'], // 字二本枠
  ['犹', '犾'], // 犾森
  ['繫', '繋'], // 中繫
  ['霳', '豊'], // 豊隆
  ['霻', '豊'], // 豊隆
  ['冝', '宜'], // 祢宜沢
  ['桵', 'たら'], // 桵葉沢
  ['挼', 'たら'], // 桵葉沢
  ['疇', '畴'], // 十五畴
  ['荕', '莇'], // 莇沢
  ['貒', '猯'], // 字猯
  ['丒', '丑'], // 丑ヶ沢
  ['椧', '掵'], // 字掵ノ上
  ['鏥', '錆'], // 
  ['㚑', '霊'], // 霊堂
  ['廹', '迫'], // 小木迫
  ['㫪', '春'], // 
  ['舂', '春'], // 
  ['𣇃', '春'], // 
  ['莄', '萸'], // 茱莄平
  ['頥', '頤'], // 字宗頤町
  ['鵃', '鶚'], // 字鶚沢
  ['槶', '椢'], // 椢内
  ['龗', '龍'], // 
  ['靇', '龍'], // 
  ['𠀋', '丈'], // 大𠀋蔵
  ['圡', '土'], // 空𡈽
  ['圡', '土'], // 空圡
  ['坫', '岾'], // 小坫
  ['桑', '桒'], // 北大桒
  ['桒', '桒'], // 桒原
  ['靏', '鶴'], // 靏見埜
  ['靎', '鶴'], // 靏見埜
  ['靍', '鶴'], // 靏見埜
  ['𠝏', '剣'], // 𠝏沢
  ['𢭏', '擣'], // 𢭏衣
  ['孁', '霎'], // 大日孁社
  ['朳', '杁'], // 朳差岳
  ['湫', '畔'], // 高田町長湫
  ['嶌', '島'], // 向嶌
  ['湏', '須'], // 須波阿湏疑神社
  ['貒', '猯'], // 西下貒穴
  ['𩿇', '鸕'], // 
  ['鷀', '鸕'], // 
  ['盧', '戸'], // 
  ['櫨', '枦'], // 
  ['𣳾', '泰'], // 𣳾原
  ['䦰', '鬮'], // 䦰本
  ['茰', '萸'], // 茱茰ノ木平
  ['扚', '杓'], // 扚子
  ['莓', '苺'], // 於莓
  ['𥔎', '碕'], // 柿𥔎町
  ['蘓', '蘇'], // 蘓生々々
  ['逹', '達'], // 逹摩
  ['䟽', '疏'], // 溲䟽原
  ['溲', '疏'], // 溲䟽原
  ['㫖', '旨'], // 長㫖
  ['忰', '悴'], // 忰谷
  ['芧', '茅'], // 
  ['﨟', '臈'], // 京ノ上﨟
  ['漥', '窪'], // 大漥
  ['𨺉', '採'], // 成相𨺉
  ['㞍', '尻'], // 見掛ノ㞍
  ['崕', '崖'], // 浜崕
  ['鸙', '雲雀'], // 鸙野
  ['楠木', '楠'],
  ['樟', '楠'],
  ['冶', '治'], // 鍛治
];

const tree = new TrieAddressFinder<string>();
for (const oldAndNew of kanji_table) {
  tree.append({
    key: oldAndNew[0],
    value: oldAndNew[1],
  });
}

export const jisKanji = <T extends string | CharNode | undefined>(target: T): T => {
  if (target === undefined) {
    return undefined as T;
  }
  if (target instanceof CharNode) {
    return jisKanjiForCharNode(target) as T;
  }
  if (typeof target === 'string') {
    let head = CharNode.create(target);
    const buffer: string[] = [];

    while (head) {
      const matches = tree.find({
        target: head,
        fuzzy: undefined,
      });
      if (!matches || matches.length === 0) {
        buffer.push(head.char!);
        head = head.next;
        continue;
      }
      buffer.push(matches[0].info!);
      head = matches[0].unmatched;
    }

    return buffer.join('') as T;
  }

  throw `unsupported value type`;
};

const jisKanjiForCharNode = (target: CharNode | undefined): CharNode | undefined => {
  let head = target;
  const buffer: CharNode[] = [];

  while (head) {
    if (head.ignore) {
      const headNext = head.next;
      const charNode = head;
      charNode.next = undefined;
      buffer.push(charNode);

      head = headNext;
      continue;
    }

    const matches = tree.find({
      target: head,
      fuzzy: undefined,
    });
    if (!matches || matches.length === 0) {
      const headNext = head.next;
      const charNode = head;
      charNode.next = undefined;
      buffer.push(charNode);
      head = headNext;
      continue;
    }

    const cnt = matches[0].depth;
    let i = 0;
    while (head && i < cnt) {
      if (head.ignore) {
        const headNext: CharNode | undefined = head.next;
        const charNode = head;
        charNode.next = undefined;
        buffer.push(charNode);
  
        head = headNext;
        continue;
      }
      const ignore = i >= matches[0].info!.length;
      const char = ignore ? '' : matches[0].info![i];
      buffer.push(new CharNode({
        originalChar: head.originalChar,
        char,
        ignore,
      }));
      i++;
      head = head.next;
    }
    
    while (i < cnt) {
      const char = i < matches[0].info!.length ? matches[0].info![i] : '';
      buffer.push(new CharNode({
        originalChar: '',
        char,
        ignore: true,
      }));
      i++;
    }

    head = matches[0].unmatched;
  }
  let tail: CharNode | undefined = undefined;
  while (buffer.length > 0) {
    const charNode = buffer.pop()!;
    charNode.next = tail;
    tail = charNode;
  }

  return tail;
};
