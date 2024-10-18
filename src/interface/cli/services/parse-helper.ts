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
import { DEFAULT_FUZZY_CHAR, STDIN_FILEPATH } from "@config/constant-values";
import fs from 'node:fs';

// yargs が '-' を解析できないので、別の文字に置き換える
export const parseHelper = (processArgv: string[]): string[] => {
  const SINGLE_SPACE = ' ';

  const result: string[] = [];
  const stack: string[] = [SINGLE_SPACE];

  for (const arg of processArgv) {
    // パスの場合は解析しない
    if (fs.existsSync(arg)) {
      stack.push(arg);
      stack.push(SINGLE_SPACE);
      continue;
    }

    // 空白が連続するとyargsの解析が失敗することがあるので、スペースが連続する場合は圧縮する
    for (const char of arg) {
      if (char === SINGLE_SPACE && stack.at(-1) === SINGLE_SPACE) {
        continue;
      }
      stack.push(char);
    }
    if (stack.at(-1) !== SINGLE_SPACE) {
      stack.push(SINGLE_SPACE);
    }
  }

  const buffer: string[] = [];
  while (stack.length > 0) {
    const char = stack.pop()!;

    if (char !== SINGLE_SPACE) {
      buffer.unshift(char);
      continue;
    }

    if (buffer.length === 0) {
      continue;
    }

    // Special replace cases
    let word = buffer.join('');
    switch (word) {
      case '-':
        word = STDIN_FILEPATH;
        break;

      case '--fuzzy':
        if (result.length === 0) {
          result.unshift(DEFAULT_FUZZY_CHAR);
        }
        break;

      default:
        break;
    }

    result.unshift(word);
    buffer.length = 0;
  }
  return result;
};
