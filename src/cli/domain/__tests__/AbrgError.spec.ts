import {AbrgMessage } from '../AbrgMessage';
import {AbrgError, AbrgErrorLevel } from '../AbrgError';
import jaMessage from '../AbrgMessage/locales/ja';
import enMessage from '../AbrgMessage/locales/en';

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