import {test, expect, describe} from "@jest/globals"
import {getLevenshteinDistanceRatio} from "../get-levenshtein-distance-ratio"

describe('getLevenshteinDistanceRatio', () => {
  test('完全一致の文字列', () => {
    expect(getLevenshteinDistanceRatio('おはようございます。', 'おはようございます。')).toBe(0);
    expect(getLevenshteinDistanceRatio('Hello', 'Hello')).toBe(0);
  });

  test('1文字だけ異なる文字列', () => {
    expect(getLevenshteinDistanceRatio('おはようございます。', 'おはよおございます。')).toBeCloseTo(0.1);
    expect(getLevenshteinDistanceRatio('Hello', 'Hallo')).toBeCloseTo(0.2);
  });

  test('大文字小文字の違い', () => {
    expect(getLevenshteinDistanceRatio('おはようございます。', 'おはょうございます。')).toBeCloseTo(0.1);
    expect(getLevenshteinDistanceRatio('Hello', 'hello')).toBeCloseTo(0.2);
  });

  test('完全に異なる文字列', () => {
    expect(getLevenshteinDistanceRatio('おはようございます。', 'こんにちは')).toBe(1);
    expect(getLevenshteinDistanceRatio('Hello', 'abc')).toBe(1);
  });

  test('空文字列との比較', () => {
    expect(getLevenshteinDistanceRatio('おはようございます。', '')).toBe(1);
    expect(getLevenshteinDistanceRatio('Hello', '')).toBe(1);
  });

  test('順序が入れ替わった文字列', () => {
    expect(getLevenshteinDistanceRatio('aaaaa', 'baaaa')).toBeCloseTo(0.2);
    expect(getLevenshteinDistanceRatio('baaaa', 'baaaa')).toBe(0);
    expect(getLevenshteinDistanceRatio('abaaa', 'baaaa')).toBeCloseTo(0.4);
    expect(getLevenshteinDistanceRatio('aabaa', 'baaaa')).toBeCloseTo(0.4);
    expect(getLevenshteinDistanceRatio('aaaba', 'baaaa')).toBeCloseTo(0.4);
    expect(getLevenshteinDistanceRatio('aaaab', 'baaaa')).toBeCloseTo(0.4);
  });
});
