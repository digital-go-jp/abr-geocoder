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

import { RegExpEx } from "../services/reg-exp-ex";


//
// 総務省：全国地方公共団体コード
// https://www.soumu.go.jp/denshijiti/code.html
//
export enum PrefLgCode {
  ALL = '000000',
  HOKKAIDO = '010006',
  AOMORI = '020001',
  IWATE = '030007',
  MIYAGI = '040002',
  AKITA = '050008',
  YAMAGATA = '060003',
  FUKUSHIMA = '070009',
  IBARAKI = '080004',
  TOCHIGI = '090000',
  GUMMA = '100005',
  SAITAMA = '110001',
  CHIBA = '120006',
  TOKYO = '130001',
  KANAGAWA = '140007',
  YAMANASHI = '190004',
  NAGANO = '200000',
  NIIGATA = '150002',
  TOYAMA = '160008',
  ISHIKAWA = '170003',
  FUKUI = '180009',
  SHIZUOKA = '220001',
  AICHI = '230006',
  GIFU = '210005',
  MIE = '240001',
  SHIGA = '250007',
  KYOTO = '260002',
  OSAKA = '270008',
  HYOGO = '280003',
  NARA = '290009',
  WAKAYAMA = '300004',
  OKAYAMA = '330001',
  HIROSHIMA = '340006',
  TOTTORI = '320005',
  SHIMANE = '310000',
  YAMAGUCHI = '350001',
  TOKUSHIMA = '360007',
  KAGAWA = '370002',
  EHIME = '380008',
  KOCHI = '390003',
  FUKUOKA = '400009',
  SAGA = '410004',
  NAGASAKI = '420000',
  OITA = '440001',
  KUMAMOTO = '430005',
  MIYAZAKI = '450006',
  KAGOSHIMA = '460001',
  OKINAWA = '470007',
}

const prefMap = new Set<string>(Object.values(PrefLgCode));
export const isPrefLgCode = (target: string): target is PrefLgCode => prefMap.has(target);

export const toPrefLgCode = (lgCode: string): PrefLgCode | undefined => {
  if (isPrefLgCode(lgCode)) {
    return lgCode;
  }
  if (lgCode.length !== 6 || RegExpEx.create('[^0-9]').test(lgCode)) {
    return;
  }
  const prefix = lgCode.substring(0, 2);
  for (const prefLgCode of prefMap.values()) {
    if (prefLgCode.startsWith(prefix)) {
      return prefLgCode as PrefLgCode;
    }
  }
}