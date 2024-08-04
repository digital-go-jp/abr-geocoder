import { test, expect, describe } from '@jest/globals'
import { toHiragana } from '../to-hiragana'

describe('toHiragana', () => {
  test('test1', ()=> {
    const result = toHiragana('アイウエオ')
    expect(result).toBe('あいうえお')
  })

  test('test2', ()=>{
    const result = toHiragana('漢字キャンセ半角')
    expect(result).toBe('漢字きやんせ半角')
  })
})