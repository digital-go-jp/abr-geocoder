import { describe, expect, it } from '@jest/globals';
import { AbrgError, AbrgErrorLevel } from '../AbrgError';
import { AbrgMessage } from '../AbrgMessage';
import enMessage from '../AbrgMessage/locales/en';
import jaMessage from '../AbrgMessage/locales/ja';

describe('AbrgError', () => {
  it('message should be written in Japanese', () => {
    AbrgMessage.setLocale('ja');
    expect(() => {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_FIND_INPUT_FILE,
        level: AbrgErrorLevel.DEBUG,
      });
    }).toThrow(jaMessage.CANNOT_FIND_INPUT_FILE);
  });

  it('message should be written in English', () => {
    AbrgMessage.setLocale('en');
    expect(() => {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_FIND_INPUT_FILE,
        level: AbrgErrorLevel.DEBUG,
      });
    }).toThrow(enMessage.CANNOT_FIND_INPUT_FILE);
  });
});
