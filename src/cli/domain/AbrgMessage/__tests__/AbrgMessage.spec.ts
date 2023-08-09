import { AbrgMessage } from '..';
import enMessages from '../locales/en';
import jaMessages from '../locales/ja';


describe('AbrgMessage', () => {
  describe('toString()', () => {
    it('returns message by English', () => {
      AbrgMessage.setLocale('en');
      const result = AbrgMessage.toString(AbrgMessage.CHECKING_UPDATE);
      expect(result).toEqual(enMessages.CHECKING_UPDATE);
    });

    it('returns message by Japanese', () => {
      AbrgMessage.setLocale('ja');
      const result = AbrgMessage.toString(AbrgMessage.CHECKING_UPDATE);
      expect(result).toEqual(jaMessages.CHECKING_UPDATE);
    })
  })
});