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
import { Transform, TransformCallback } from 'node:stream';

export interface CoordinateData {
  lat: number;
  lon: number;
  originalLine: string;
}

export class CoordinateParsingTransform extends Transform {
  private headerProcessed = false;
  private latIndex = -1;
  private lonIndex = -1;

  constructor() {
    super({
      objectMode: true,
      allowHalfOpen: false,
    });
  }

  _transform(chunk: any, _encoding: BufferEncoding, callback: TransformCallback): void {
    const line = chunk.toString().trim();
    
    if (!line) {
      callback();
      return;
    }

    // ヘッダー行の処理
    if (!this.headerProcessed) {
      this.processHeader(line);
      this.headerProcessed = true;
      callback();
      return;
    }

    try {
      const coordinate = this.parseCoordinate(line);
      if (coordinate) {
        this.push(coordinate);
      }
    } catch (error) {
      // エラー行はスキップして処理を継続
    }

    callback();
  }

  private processHeader(line: string): void {
    const columns = line.split(',').map(col => col.trim().toLowerCase());
    
    // 緯度のカラムを検索
    this.latIndex = this.findColumnIndex(columns, ['lat', 'latitude', '緯度']);
    
    // 経度のカラムを検索  
    this.lonIndex = this.findColumnIndex(columns, ['lon', 'lng', 'longitude', '経度']);
    
    // ヘッダーがない場合は最初の2列を座標とみなす
    if (this.latIndex === -1 && this.lonIndex === -1) {
      this.latIndex = 0;
      this.lonIndex = 1;
      // ヘッダーがない場合、この行を座標データとして処理
      this.headerProcessed = false;
    }
  }

  private findColumnIndex(columns: string[], searchTerms: string[]): number {
    for (const term of searchTerms) {
      const index = columns.findIndex(col => col.includes(term));
      if (index !== -1) {
        return index;
      }
    }
    return -1;
  }

  private parseCoordinate(line: string): CoordinateData | null {
    const values = line.split(',').map(val => val.trim());
    
    if (values.length < 2) {
      return null;
    }

    const latStr = values[this.latIndex] || values[0];
    const lonStr = values[this.lonIndex] || values[1];

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    // バリデーション
    if (isNaN(lat) || isNaN(lon)) {
      return null;
    }

    if (lat < -90 || lat > 90) {
      return null;
    }

    if (lon < -180 || lon > 180) {
      return null;
    }

    return {
      lat,
      lon,
      originalLine: line,
    };
  }
}