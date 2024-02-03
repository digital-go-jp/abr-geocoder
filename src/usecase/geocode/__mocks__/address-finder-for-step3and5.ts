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
import { jest } from '@jest/globals';
import { PrefectureName } from '@domain/prefecture-name';
import { FindParameters } from '../address-finder-for-step3and5';

export const AddressFinderForStep3and5 = jest.fn().mockImplementation(() => {
  return {
    find: (params: FindParameters) => {
      switch (params.prefecture) {
        case PrefectureName.TOKYO:
          //
          // Dummy result for step3b-transform.spec.ts
          //
          return Promise.resolve({
            lg_code: '132063',
            town_id: '0001002',
            name: '本宿町2丁目',
            koaza: '',
            lat: 35.672654,
            lon: 139.46089,
            originalName: '',
            tempAddress: '22番地の22',
          });

        case PrefectureName.HIROSHIMA:
          //
          // Dummy result for step3b-transform.spec.ts
          //
          return Promise.resolve(null);

        case PrefectureName.KYOTO:
          //
          // Dummy result for step5-transform.spec.ts
          //
          return Promise.resolve({
            koaza: '',
            lat: 34.877027, 
            lg_code: '262102',
            lon: 135.708529,
            name: '八幡園内',
            originalName: '',
            tempAddress: '75', 
            town_id: '0302000'
          });

        default:
          throw new Error(
            `Unexpected prefecture was given: ${params.prefecture}`
          );
      }
    },
  };
});
