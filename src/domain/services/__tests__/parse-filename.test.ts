import { test, describe, expect } from '@jest/globals';
import { parseFilename } from '@domain/services/parse-filename';

describe('parseFilename', () => {
  test('パターンマッチ1', () => {
    const res = parseFilename({
      filepath: "mt_city_all.zip",
    });
    expect(res).toEqual({
      type: "city",
      type2: "all",
      lgCode : "",
      prefLgCode: "000000",
      path: "mt_city_all.zip",
      filename: "mt_city_all.zip",
    });
  });
  test('パターンマッチ2', () => {
    const res = parseFilename({
      filepath: "mt_city_pos_all.zip",
    });
    expect(res).toEqual({
      type: "city_pos",
      type2: "all",
      lgCode : "",
      prefLgCode: "000000",
      path: "mt_city_pos_all.zip",
      filename: "mt_city_pos_all.zip",
    });
  });
  test('パターンマッチ3', () => {
    const res = parseFilename({
      filepath: "mt_rsdtdsp_blk_all.zip",
    });
    expect(res).toEqual({
      type: "rsdtdsp_blk",
      type2: "all",
      lgCode : "",
      prefLgCode: "000000",
      path: "mt_rsdtdsp_blk_all.zip",
      filename: "mt_rsdtdsp_blk_all.zip",
    });
  });
  test('パターンマッチ4', () => {
    const res = parseFilename({
      filepath: "mt_rsdtdsp_blk_pos_all.zip",
    });
    expect(res).toEqual({
      type: "rsdtdsp_blk_pos",
      type2: "all",
      lgCode : "",
      prefLgCode: "000000",
      path: "mt_rsdtdsp_blk_pos_all.zip",
      filename: "mt_rsdtdsp_blk_pos_all.zip",
    });
  });
  test('パターンマッチ5 失敗した場合はnullが返る', () => {
    const res = parseFilename({
      filepath: "mt_city_blk_all.zip",
    });
    expect(res).toEqual(null);
  });
  test('パターンマッチ6 失敗した場合はnullが返る', () => {
    const res = parseFilename({
      filepath: "mt_city_blk_pos_all.zip",
    });
    expect(res).toEqual(null);
  });
  test('パターンマッチ7 失敗した場合はnullが返る', () => {
    const res = parseFilename({
      filepath: "mt_rsdtdsp_all.zip",
    });
    expect(res).toEqual(null);
  });
  test('allの場合はprefCodeが無視されて000000が返る', () => {
    const res = parseFilename({
      filepath: "mt_city_all01.zip",
    });
    expect(res).toEqual({
      type: "city",
      type2: "all",
      lgCode : "",
      prefLgCode: "000000",
      path: "mt_city_all01.zip",
      filename: "mt_city_all01.zip",
    });
  });
  test('相対パスで渡された場合', () => {
    const res = parseFilename({
      filepath: "foo/bar/mt_rsdtdsp_blk_pref01.zip",
    });
    expect(res).toEqual({
      type: "rsdtdsp_blk",
      type2: "pref",
      lgCode : "01....",
      prefLgCode: "010006",
      path: "foo/bar/mt_rsdtdsp_blk_pref01.zip",
      filename: "mt_rsdtdsp_blk_pref01.zip",
    });
  });
  test('prefのlgCodeの値が取得できる', () => {
    const res = parseFilename({
      filepath: "mt_pref_pref10.zip",
    });
    expect(res).toEqual({
      type: "pref",
      type2: "pref",
      lgCode : "10....",
      prefLgCode: "100005",
      path: "mt_pref_pref10.zip",
      filename: "mt_pref_pref10.zip",
    });
  });
  test('cityのlgCodeの値が取得できる', () => {
    const res = parseFilename({
      filepath: "mt_pref_city123456.zip",
    });
    expect(res).toEqual({
      type: "pref",
      type2: "city",
      lgCode : "123456",
      prefLgCode: "120006",
      path: "mt_pref_city123456.zip",
      filename: "mt_pref_city123456.zip",
    });
  });
  test('空文字が渡された場合は、nullが返る', () => {
    const res = parseFilename({
      filepath: "",
    });
    expect(res).toEqual(null);
  });
  test('存在しないprefLgCodeが渡された場合は、nullが返る', () => {
    const res = parseFilename({
      filepath: "mt_rsdtdsp_blk_pref99.zip",
    });
    expect(res).toEqual(null);
  });
});
