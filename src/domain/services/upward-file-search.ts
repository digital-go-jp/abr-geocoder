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
import fs from 'node:fs';
import path from 'node:path';

export async function upwardFileSearch(
  currDir: string,
  targetFilename: string
): Promise<string | undefined> {
  try {
    const files = await fs.promises.readdir(currDir);
    const existFile = files.some(file => file.endsWith(targetFilename));

    // 見つかった場合は探索終了
    if (existFile) {
      return path.resolve(currDir, targetFilename);
    }

    // 見つからない場合は1つ上の階層を探索
    return upwardFileSearch(path.resolve(currDir, '..'), targetFilename);
  } catch (err) {
    // root directoryに達した時点でエラーになるはずなので、探索を辞める
    return undefined;
  }
}