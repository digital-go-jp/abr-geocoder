/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
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
import { GeocodeResult } from '@domain/geocode-result';

export const dummyData = [
  new GeocodeResult(
    '東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階',
    8,
    35.681411,
    139.73495,
    ' 東京ガーデンテラス紀尾井町 19階、20階',
    '東京都',
    '千代田区',
    '紀尾井町',
    '0056000',
    '131016',
    '1',
    '001',
    '3',
    '003',
    '',
    '',
  ),

  new GeocodeResult(
    '東京都千代田区紀尾井町1',
    3,
    35.681411,
    139.73495,
    '',
    '東京都',
    '千代田区',
    '紀尾井町',
    '0056000',
    '131016',
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ),

  new GeocodeResult(
    '山形県山形市旅篭町二丁目3番25号',
    8,
    38.255437,
    140.339126,
    '',
    '山形県',
    '山形市',
    '旅篭町二丁目',
    '0247002',
    '062014',
    '3',
    '003',
    '25',
    '025',
    '',
    '',
  ),

  new GeocodeResult(
    '山形市旅篭町二丁目3番25号',
    8,
    38.255437,
    140.339126,
    '',
    '山形県',
    '山形市',
    '旅篭町二丁目',
    '0247002',
    '062014',
    '3',
    '003',
    '25',
    '025',
    '',
    '',
  ),

  new GeocodeResult(
    '東京都町田市森野2-2-22',
    8,
    35.548247,
    139.440264,
    '',
    '東京都',
    '町田市',
    '森野二丁目',
    '0006002',
    '132098',
    '2',
    '002',
    '22',
    '022',
    '',
    '',
  ),
];