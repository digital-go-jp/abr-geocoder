import { jest } from '@jest/globals';

import { TrieAddressFinder2 } from '../trie/__mocks__/trie-finder2';

export class OazaChoTrieFinder extends TrieAddressFinder2 {
  static readonly createDictionaryFile = jest.fn();
  static readonly loadDataFile = jest.fn();
}
