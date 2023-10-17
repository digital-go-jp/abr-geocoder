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
import { SingleBar } from 'cli-progress';
import prettyBytes from 'pretty-bytes';

export const provideProgressBar = (): SingleBar => {
  return new SingleBar({
    // Since Visual Code does not display stdError for some reason, we use stdout instead.
    stream: process.stdout,
    format: ' {bar} {percentage}% | ETA: {eta_formatted} | {value}/{total}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    etaBuffer: 30,
    fps: 2,
    formatValue: (v, options, type) => {
      if (type === 'value' || type === 'total') {
        return prettyBytes(v);
      }

      // no autopadding ? passthrough
      if (options.autopadding !== true) {
        return v.toString();
      }

      // padding
      function autopadding(value: number, length: number) {
        return ((options.autopaddingChar || ' ') + value).slice(-length);
      }

      switch (type) {
        case 'percentage':
          return autopadding(v, 3);

        default:
          return v.toString();
      }
    },
  });
};
