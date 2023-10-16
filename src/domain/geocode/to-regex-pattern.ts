import { RegExpEx, jisKanji } from '../';

/**
 * オリジナルコード
 * https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/lib/dict.ts#L25C1-L61C1
 */
export const toRegexPattern = (address: string): string => {
  // 以下なるべく文字数が多いものほど上にすること
  address = address
    .replace(RegExpEx.create('三栄町|四谷三栄町', 'g'), '(三栄町|四谷三栄町)')
    .replace(
      RegExpEx.create('鬮野川|くじ野川|くじの川', 'g'),
      '(鬮野川|くじ野川|くじの川)'
    )
    .replace(RegExpEx.create('通り|とおり', 'g'), '(通り|とおり)')
    .replace(RegExpEx.create('埠頭|ふ頭', 'g'), '(埠頭|ふ頭)')
    .replace(RegExpEx.create('番町|番丁', 'g'), '(番町|番丁)')
    .replace(RegExpEx.create('大冝|大宜', 'g'), '(大冝|大宜)')
    .replace(RegExpEx.create('穝|さい', 'g'), '(穝|さい)')
    .replace(RegExpEx.create('杁|えぶり', 'g'), '(杁|えぶり)')
    .replace(RegExpEx.create('薭|稗|ひえ|ヒエ', 'g'), '(薭|稗|ひえ|ヒエ)')
    .replace(RegExpEx.create('[のノ之丿]', 'g'), '[のノ之丿]')
    .replace(RegExpEx.create('[ヶケが]', 'g'), '[ヶケが]')
    .replace(RegExpEx.create('[ヵカか力]', 'g'), '[ヵカか力]')
    .replace(RegExpEx.create('[ッツっつ]', 'g'), '[ッツっつ]')
    .replace(RegExpEx.create('[ニ二]', 'g'), '[ニ二]')
    .replace(RegExpEx.create('[ハ八]', 'g'), '[ハ八]')
    .replace(RegExpEx.create('塚|塚', 'g'), '(塚|塚)')
    .replace(RegExpEx.create('釜|竈', 'g'), '(釜|竈)')
    .replace(RegExpEx.create('條|条', 'g'), '(條|条)')
    .replace(RegExpEx.create('狛|拍', 'g'), '(狛|拍)')
    .replace(RegExpEx.create('藪|薮', 'g'), '(藪|薮)')
    .replace(RegExpEx.create('渕|淵', 'g'), '(渕|淵)')
    .replace(RegExpEx.create('エ|ヱ|え', 'g'), '(エ|ヱ|え)')
    .replace(RegExpEx.create('曾|曽', 'g'), '(曾|曽)')
    .replace(RegExpEx.create('舟|船', 'g'), '(舟|船)')
    .replace(RegExpEx.create('莵|菟', 'g'), '(莵|菟)')
    .replace(RegExpEx.create('市|巿', 'g'), '(市|巿)');

  address = jisKanji(address);

  return address;
};
