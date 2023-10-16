import fs from 'node:fs';
import { SINGLE_DASH_ALTERNATIVE } from '../../settings/constant-values';
import { AbrgMessage } from '../abrg-message';
import { AbrgError, AbrgErrorLevel } from '../abrg-error';

export const getReadStreamFromSource = (
  source: string
): NodeJS.ReadStream | fs.ReadStream => {
  if (source === SINGLE_DASH_ALTERNATIVE) {
    // パイプ処理なしで、`abrg -` とされた場合はエラー
    if (process.stdin.isTTY) {
      throw new AbrgError({
        messageId: AbrgMessage.INPUT_SOURCE_FROM_STDIN_ERROR,
        level: AbrgErrorLevel.ERROR,
      });
    }
    return process.stdin;
  }

  const exists = fs.existsSync(source);
  if (exists) {
    return fs.createReadStream(source);
  }
  throw new AbrgError({
    messageId: AbrgMessage.CANNOT_FIND_INPUT_FILE,
    level: AbrgErrorLevel.ERROR,
  });
};
