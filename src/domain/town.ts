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
export interface ITown {
  name: string;
  lg_code: string;
  town_id: string;
  koaza: string;
  lat: number;
  lon: number;
  originalName?: string;
  tempAddress?: string;
}

export class Town implements ITown {
  public readonly name: string;
  public readonly lg_code: string;
  public readonly town_id: string;
  public readonly koaza: string;
  public readonly lat: number;
  public readonly lon: number;

  constructor(params: ITown) {
    this.name = params.name;
    this.lg_code = params.lg_code;
    this.town_id = params.town_id;
    this.koaza = params.koaza;
    this.lat = params.lat;
    this.lon = params.lon;
    Object.freeze(this);
  }
}
