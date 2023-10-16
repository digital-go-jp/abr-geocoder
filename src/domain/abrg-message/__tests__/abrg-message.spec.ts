import { describe, expect, it } from '@jest/globals';
import { AbrgMessage } from '..';
import enMessages from '../locales/en';
import jaMessages from '../locales/ja';

describe('AbrgMessage', () => {
  describe('toString()', () => {
    it.concurrent('should return message by English', async () => {
      AbrgMessage.setLocale('en');
      const result = AbrgMessage.toString(AbrgMessage.CHECKING_UPDATE);
      expect(result).toEqual(enMessages.CHECKING_UPDATE);
    });

    it.concurrent('should return message by Japanese', async () => {
      AbrgMessage.setLocale('ja');
      const result = AbrgMessage.toString(AbrgMessage.CHECKING_UPDATE);
      expect(result).toEqual(jaMessages.CHECKING_UPDATE);
    });
  });
});
