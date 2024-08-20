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
import { LineStream } from 'byline';
import fs from 'node:fs';
import { Writable } from 'node:stream';
import { CommentFilterTransform } from '../transformations/comment-filter-transform';
export const countRequests = (filePath: string) => {
  const lineByLine = new LineStream();
  const commentFilter = new CommentFilterTransform();
  return new Promise((
    resolve: (total: number) => void,
  ) => {
    fs.createReadStream(filePath)
      .pipe(lineByLine)
      .pipe(commentFilter)
      .pipe(new Writable({
        objectMode: true,
        write(chunk, encoding, callback) {
          callback();
        },
        final(callback) {
          callback();
          resolve(commentFilter.total);
        },
      }));
  });
};
