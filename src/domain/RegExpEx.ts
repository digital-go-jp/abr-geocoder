/**
 * 正規表現をキャッシュするためのクラス
 * RegExpEx.create() で new RegExp() と同じように使用する
 */
export class RegExpEx extends RegExp {
  private constructor(pattern: string, flag: string | undefined) {
    super(pattern, flag);
  }

  private static staticCache = new Map<string, RegExpEx>();

  private static getKey(pattern: string, flag: string = ''): string {
    return `${pattern}_${flag}`;
  }

  static create(pattern: string, flag: string = ''): RegExpEx {
    const patternStr = pattern.toString();
    const key = RegExpEx.getKey(patternStr, flag);
    if (RegExpEx.staticCache.has(key)) {
      return RegExpEx.staticCache.get(key)!;
    }
    const instance = new RegExpEx(patternStr, flag);
    RegExpEx.staticCache.set(key, instance);
    return instance;
  }
}
