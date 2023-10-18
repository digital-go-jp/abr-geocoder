/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { DummyCsvFile } from "@domain/dataset/__mocks__/dummy-csv.skip";
import { setupContainer } from "@interface-adapter/__mocks__/setup-container";
import { describe, expect, it, jest } from "@jest/globals";
import Database from 'better-sqlite3';
import Stream from "node:stream";
import { DependencyContainer } from "tsyringe";
import { loadDatasetProcess } from "../load-dataset-process";

jest.mock("@domain/dataset/pref-dataset-file");
jest.mock("@domain/dataset/city-dataset-file");
jest.mock("@domain/dataset/town-dataset-file");
jest.mock("@domain/dataset/rsdtdsp-blk-file");
jest.mock("@domain/dataset/rsdtdsp-rsdt-file");
jest.mock("@domain/dataset/town-pos-dataset-file");
jest.mock("@domain/dataset/rsdtdsp-blk-pos-file");
jest.mock("@domain/dataset/rsdtdsp-rsdt-pos-file");
jest.mock('@interface-adapter/setup-container');
jest.mock('better-sqlite3');
jest.mock('csv-parser');
jest.dontMock('../load-dataset-process')

const mt_town_pos_pref01_csv = () => {
  return new DummyCsvFile({
    name: 'mt_town_pos_pref01.csv',
    crc32: 4236985285,
    contentLength: 2229768,
    lastModified: 1674556138000,
    getStream(): Promise<NodeJS.ReadableStream> {
      return Promise.resolve(Stream.Readable.from([{
        "全国地方公共団体コード": "202011",
        "町字id": "0000101",
        "住居表示フラグ": "0",
        "代表点_経度": "138.184886",
        "代表点_緯度": "36.595508",
        "代表点_座標参照系": "EPSG:6668",
        "代表点_地図情報レベル": "25000",
        "ポリゴン_ファイル名": "",
        "ポリゴン_キーコード": "",
        "ポリゴン_データフォーマット": "",
        "ポリゴン_座標参照系": "",
        "ポリゴン_地図情報レベル": "",
        "位置参照情報_大字町丁目コード": "",
        "位置参照情報_データ整備年度": "",
        "国勢調査_境界_小地域（町丁・字等別）": "",
        "国勢調査_境界_データ整備年度": ""
      }]))
    }
  });
};

const mt_town_all_csv = () => {
  return new DummyCsvFile({
    name: 'mt_town_all.csv',
    crc32: 3996387812,
    contentLength: 152740134,
    lastModified: 1674556118000,
    getStream(): Promise<NodeJS.ReadableStream> {
      return Promise.resolve(Stream.Readable.from([{
        "全国地方公共団体コード": "011011",
        "町字id": "0001001",
        "町字区分コード": "2",
        "都道府県名": "北海道",
        "都道府県名_カナ": "ホッカイドウ",
        "都道府県名_英字": "Hokkaido",
        "郡名": "",
        "郡名_カナ": "",
        "郡名_英字": "",
        "市区町村名": "札幌市",
        "市区町村名_カナ": "サッポロシ",
        "市区町村名_英字": "Sapporo-shi",
        "政令市区名": "中央区",
        "政令市区名_カナ": "チュウオウク",
        "政令市区名_英字": "Chuo-ku",
        "大字・町名": "旭ケ丘",
        "大字・町名_カナ": "アサヒガオカ",
        "大字・町名_英字": "Asahigaoka",
        "丁目名": "一丁目",
        "丁目名_カナ": "１チョウメ",
        "丁目名_数字": "1",
        "小字名": "",
        "小字名_カナ": "",
        "小字名_英字": "",
        "住居表示フラグ": "1",
        "住居表示方式コード": "1",
        "大字・町名_通称フラグ": "0",
        "小字名_通称フラグ": "0",
        "大字・町名_電子国土基本図外字": "0",
        "小字名_電子国土基本図外字": "0",
        "状態フラグ": "0",
        "起番フラグ": "1",
        "効力発生日": "1947-04-17",
        "廃止日": "",
        "原典資料コード": "0",
        "郵便番号": "",
        "備考": ""
      }]))
    }
  });
}
const mt_rsdtdsp_rsdt_pos_pref01_csv = () => {
  return new DummyCsvFile({
    name: 'mt_rsdtdsp_rsdt_pos_pref01.csv',
    crc32: 3025020626,
    contentLength: 229730854,
    lastModified: 1674556268000,
    getStream(): Promise<NodeJS.ReadableStream> {
      return Promise.resolve(Stream.Readable.from([{
        "全国地方公共団体コード": "011011",
        "町字id": "0001001",
        "街区id": "001",
        "住居id": "001",
        "住居2id": "",
        "住居表示フラグ": "1",
        "住居表示方式コード": "1",
        "基礎番号・住居番号区分": "0",
        "代表点_経度": "141.319856069",
        "代表点_緯度": "43.044001792",
        "代表点_座標参照系": "EPSG:6668",
        "代表点_地図情報レベル": "2500",
        "電子国土基本図(地図情報)「住居表示住所」_住所コード(可読)": "http://gi.gsi.go.jp/jusho/01101/AGO-1/1/1",
        "電子国土基本図（地名情報）「住居表示住所」_データ整備日": "2019-03-27"
      }
    ]))
    }
  });
}

const mt_rsdtdsp_rsdt_pref01_csv = () => {
 return new DummyCsvFile({
    name: 'mt_rsdtdsp_rsdt_pref01.csv',
    crc32: 3685780372,
    contentLength: 174393385,
    lastModified: 1674556208000,
    getStream(): Promise<NodeJS.ReadableStream> {
      return Promise.resolve(Stream.Readable.from([{
        "全国地方公共団体コード": "011011",
        "町字id": "0001001",
        "街区id": "001",
        "住居id": "001",
        "住居2id": "",
        "市区町村名": "札幌市",
        "政令市区名": "中央区",
        "大字・町名": "旭ケ丘",
        "丁目名": "一丁目",
        "小字名": "",
        "街区符号": "1",
        "住居番号": "1",
        "住居番号2": "",
        "基礎番号・住居番号区分": "0",
        "住居表示フラグ": "1",
        "住居表示方式コード": "1",
        "大字・町名_電子国土基本図外字": "0",
        "小字名_電子国土基本図外字": "0",
        "状態フラグ": "0",
        "効力発生日": "1947-04-17",
        "廃止日": "",
        "原典資料コード": "0",
        "備考": ""
      }]))
    }
  });
}
const mt_rsdtdsp_blk_pos_pref01_csv = () => {
  return  new DummyCsvFile({
    name: 'mt_rsdtdsp_blk_pos_pref01.csv',
    crc32: 3050934268,
    contentLength: 15992158,
    lastModified: 1674556152000,
    getStream(): Promise<NodeJS.ReadableStream> {
      return Promise.resolve(Stream.Readable.from([
        {
          "全国地方公共団体コード": "011011",
          "町字id": "0001001",
          "街区id": "001",
          "住居表示フラグ": "1",
          "住居表示方式コード": "1",
          "代表点_経度": "141.319906",
          "代表点_緯度": "43.04383",
          "代表点_座標参照系": "EPSG:4612",
          "代表点_地図情報レベル": "2500",
          "ポリゴン_ファイル名": "",
          "ポリゴン_キーコード": "",
          "ポリゴン_データ_フォーマット": "",
          "ポリゴン_座標参照系": "",
          "ポリゴン_地図情報レベル": "",
          "位置参照情報_都道府県名": "北海道",
          "位置参照情報_市区町村名": "札幌市中央区",
          "位置参照情報_大字・町丁目名": "旭ケ丘一丁目",
          "位置参照情報_小字・通称名": "",
          "位置参照情報_街区符号・地番": "1",
          "位置参照情報_データ整備年度": "2020",
          "電子国土基本図(地図情報)「住居表示住所」_住所コード(可読)": "http://gi.gsi.go.jp/jusho/01101/AGO-1/1",
          "電子国土基本図（地名情報）「住居表示住所」_データ整備日": "2019-03-27"
        }
      ]))
    }
  });
}
const mt_rsdtdsp_blk_pref01_csv = () => {
  return new DummyCsvFile({
    name: 'mt_rsdtdsp_blk_pref01.csv',
    crc32: 1012054291,
    contentLength: 7434057,
    lastModified: 1674556144000,
    getStream(): Promise<NodeJS.ReadableStream> {
      return Promise.resolve(Stream.Readable.from([
        {
          "全国地方公共団体コード": "392014",
          "町字id": "0001000",
          "街区id": "001",
          "市区町村名": "高知市",
          "政令市区名": "相生町",
          "大字・町名": "",
          "丁目名": "1",
          "小字名": "",
          "街区符号": "1",
          "住居表示フラグ": "1",
          "住居表示方式コード": "1",
          "大字・町名_電子国土基本図外字": "0",
          "小字名_電子国土基本図外字": "0",
          "状態フラグ": "0",
          "効力発生日": "1947-04-17",
          "廃止日": "",
          "原典資料コード": "0",
          "備考": "",
        }
      ]))
    }
  });
}
const mt_pref_all_csv = () => {
  return new DummyCsvFile({
    name: 'mt_pref_all.csv',
    crc32: 956018549,
    contentLength: 2758,
    lastModified: 1641570854000,
    getStream(): Promise<NodeJS.ReadableStream> {
      return Promise.resolve(Stream.Readable.from([
        {
          "全国地方公共団体コード": "010006",
          "都道府県名": "北海道",
          "都道府県名_カナ": "ホッカイドウ",
          "都道府県名_英字": "Hokkaido",
          "効力発生日": "1947-04-17",
          "廃止日": "",
          "備考": "",
        }
      ]))
    }
  });
}
const mt_city_all_csv = () => {
  return new DummyCsvFile({
    name: 'mt_city_all.csv',
    crc32: 814415613,
    contentLength: 237764,
    lastModified: 1674556098000,

    getStream(): Promise<NodeJS.ReadableStream> {
      return Promise.resolve(Stream.Readable.from([
        {
          "全国地方公共団体コード": "011002",
          "都道府県名": "北海道",
          "都道府県名_カナ": "ホッカイドウ",
          "都道府県名_英字": "Hokkaido",
          "郡名": "",
          "郡名_カナ": "",
          "郡名_英字": "",
          "市区町村名": "札幌市",
          "市区町村名_カナ": "サッポロシ",
          "市区町村名_英字": "Sapporo-shi",
          "政令市区名": "",
          "政令市区名_カナ": "",
          "政令市区名_英字": "",
          "効力発生日": "1947-04-17",
          "廃止日": "",
          "備考": "",
        }
      ]))
    }
  });
}


describe('load-dataset-process', () => {
  const container = setupContainer() as DependencyContainer;
  const db = new Database("dummy db");
  const csvFiles = [
    mt_city_all_csv(),
    mt_pref_all_csv(),
    mt_rsdtdsp_blk_pref01_csv(),
    mt_rsdtdsp_blk_pos_pref01_csv(),
    mt_rsdtdsp_rsdt_pref01_csv(),
    mt_rsdtdsp_rsdt_pos_pref01_csv(),
    mt_town_all_csv(),
    mt_town_pos_pref01_csv(),
  ];		

  it('should return csv file list', async () => { 
    await loadDatasetProcess({
      db,
      container,
      csvFiles,
    });
    expect(db.exec).toBeCalledWith("BEGIN");
    expect(db.prepare).toBeCalledWith("CityDatasetFile sql");
    expect(db.prepare).toBeCalledWith("PrefDatasetFile sql");
    expect(db.prepare).toBeCalledWith("RsdtdspBlkFile sql");
    expect(db.prepare).toBeCalledWith("RsdtdspBlkPosFile sql");
    expect(db.prepare).toBeCalledWith("RsdtdspRsdtFile sql");
    expect(db.prepare).toBeCalledWith("RsdtdspRsdtPosFile sql");
    expect(db.prepare).toBeCalledWith("TownDatasetFile sql");
    expect(db.prepare).toBeCalledWith("TownPosDatasetFile sql");
    expect(db.exec).toBeCalledWith("COMMIT");
  })
});
