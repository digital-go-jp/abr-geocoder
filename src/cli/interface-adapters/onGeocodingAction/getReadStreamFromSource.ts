import fs from 'node:fs';
import { AbrgError, AbrgErrorLevel } from '../../domain';
import { AbrgMessage } from "../../domain/AbrgMessage";

export const getReadStreamFromSource = (
  source: string,
): NodeJS.ReadStream | fs.ReadStream => {

  if (source === '-') {
    if (process.stdin.isTTY) {
      throw new AbrgError({
        messageId: AbrgMessage.INPUT_SOURCE_FROM_STDIN_ERROR,
        level: AbrgErrorLevel.ERROR,
      });
    }
    return process.stdin;
  }
  
  if (fs.existsSync(source)) {
    return fs.createReadStream(source);
  }
  throw new AbrgError({
    messageId: AbrgMessage.CANNOT_FIND_INPUT_FILE,
    level: AbrgErrorLevel.ERROR,
  });
}