import { DEFAULT_FUZZY_CHAR, SINGLE_DASH_ALTERNATIVE } from "@config/constant-values";
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
        word = SINGLE_DASH_ALTERNATIVE;
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