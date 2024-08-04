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

/*
 * 文字列の類似度を計算するレーベンシュタイン距離。
 * 1.0 に近いほど strA と strB は類似度が高い。
 * 将来的に使えそうなので、置いておく。
 */
export const getLevenshteinDistanceRatio = (strA: string, strB: string): number => {
  const N = strA.length;
  const M = strB.length;
  const dp: number[][] = new Array<number[] | null>(N + 1)
    .fill(null)
    .map(() => new Array<number>(M + 1).fill(0));

  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= M; j++) {
      if (i === 0) {
        // <ベースケース>
        // strA が 文字数 = 0 で、strBが 文字数 = jだった場合、
        // strA を strB にするには、cost = j が発生する (j文字挿入する)
        dp[i][j] = j;
      } else if (j === 0) {
        // <ベースケース>
        // strA が 文字数 = i で、 strBが 文字数 = 0 だった場合、
        // strA を strB にするには、cost = i が発生する (i文字削除する)
        dp[i][j] = i;
      } else {
        // 1文字を挿入した場合 -> cost = 1
        // 1文字削除した場合 -> cost = 1
        // strA[i] === strB[j] の場合 -> cost = 0
        // strA[i] !== strB[j] の場合 -> cost = 1
        dp[i][j] = Math.min(
          dp[i][j - 1] + 1, // 1文字挿入
          dp[i - 1][j] + 1, // 1文字削除
          dp[i - 1][j - 1] + (strA[i - 1] !== strB[j - 1] ? 1 : 0)
        );
      }
    }
  }

  // 文字列長で正規化する
  return dp[N][M] / Math.max(N, M);
};

/*
// レーベンシュタイン距離（比率）
// 上記DPコードをバックトラッキングで書き直したコード。
// 理解のために残しておく
const getLevenshteinDistanceRatio = (strA: string, strB: string): number => {
  console.clear();
  const N = strA.length;
  const M = strB.length;
  const dp: number[][] = new Array(N + 1)
    .fill(null)
    .map(row => new Array(M + 1).fill(Number.MAX_SAFE_INTEGER));

  const backtrack = (i: number, j: number): number => {
    if (dp[i][j] !== Number.MAX_SAFE_INTEGER) {
      return dp[i][j];
    }

    if (i === 0) {
      // もし strA の文字数 = 0で、 strB の文字数 = j の場合、
      // strA を strB にするには、 j文字挿入する必要がある
      dp[i][j] = j;
      return j;
    }
    if (j === 0) {
      // もし strA の文字数 = iで、 strB の文字数 = 0 の場合、
      // strA を strB にするには、 i文字削除する必要がある
      dp[i][j] = i;
      return i;
    }

    // 1文字を挿入した場合 -> cost = 1
    // 1文字削除した場合 -> cost = 1
    // strA[i] === strB[j] の場合 -> cost = 0
    // strA[i] !== strB[j] の場合 -> cost = 1
    const doInsert = backtrack(i - 1, j) + 1;
    const doDelete = backtrack(i, j - 1) + 1;
    const doCompare = backtrack(i - 1, j - 1) + (strA[i] === strB[j] ? 1 : 0);

    // 最小コストを選択する
    dp[i][j] = Math.min(doInsert, doDelete, doCompare);
    return dp[i][j];
  };
  const distance = backtrack(N, M);
  const ratio = distance / Math.max(N, M);
  return ratio;
};
*/