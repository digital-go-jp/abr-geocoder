import { describe, expect, it } from '@jest/globals';
import { AbrgError, AbrgErrorLevel } from '../abrg-error';
import { AbrgMessage } from '@abrg-message/abrg-message';
import enMessage from '@abrg-message/locales/en';
import jaMessage from '@abrg-message/locales/ja';

describe('AbrgError', () => {
  it.concurrent('message should be written in Japanese', async () => {
    AbrgMessage.setLocale('ja');
    expect(() => {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_FIND_INPUT_FILE,
        level: AbrgErrorLevel.DEBUG,
      });
    }).toThrow(jaMessage.CANNOT_FIND_INPUT_FILE);
  });

  it.concurrent('message should be written in English', async () => {
    AbrgMessage.setLocale('en');
    expect(() => {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_FIND_INPUT_FILE,
        level: AbrgErrorLevel.DEBUG,
      });
    }).toThrow(enMessage.CANNOT_FIND_INPUT_FILE);
  });
});
