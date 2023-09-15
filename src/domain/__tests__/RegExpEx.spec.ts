import { describe, expect, it, jest } from '@jest/globals';
import { RegExpEx } from '../RegExpEx';

describe('RegExpEx', () => {
  it('should be the same', () => {
    const target1 = /[a-zA-Z]/g;
    const target2 = RegExpEx.create('[a-zA-Z]', 'g');
    expect(target2).toEqual(target1);
  });

  it('should return the same instance for the same pattern', () => {
    const regExp1 = RegExpEx.create('[a-zA-Z]', 'g');
    const regExp2 = RegExpEx.create('[a-zA-Z]', 'g');
    expect(regExp1).toBe(regExp2);

    const regExp3 = RegExpEx.create('[A-Za-z]', 'g');
    const regExp4 = RegExpEx.create('[A-Za-z]', 'g');
    expect(regExp3).toBe(regExp4);

    const regExp5 = RegExpEx.create('[a-zA-Z]', 'g');
    expect(regExp5).toBe(regExp2);
  });
});
