/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
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
import { CityMatchingInfo } from "@domain/types/geocode/city-info";
import { OazaChoMachingInfo } from "@domain/types/geocode/oaza-cho-info";
import { PrefInfo } from "@domain/types/geocode/pref-info";
import { TownMatchingInfo } from "@domain/types/geocode/town-info";
import { WardMatchingInfo } from "@domain/types/geocode/ward-info";
import { ICommonDbGeocode } from "@interface/database/common-db";
import fs from 'node:fs';
import path from 'node:path';
import { deserialize, serialize } from "node:v8";

export type GeocodeWorkerCommonData = {
  prefList: PrefInfo[];
  countyAndCityList: CityMatchingInfo[];
  cityAndWardList: CityMatchingInfo[];
  wardAndOazaList: OazaChoMachingInfo[];
  oazaChomes: OazaChoMachingInfo[];
  tokyo23towns: TownMatchingInfo[];
  tokyo23wards: CityMatchingInfo[];
  wards: WardMatchingInfo[];
};

// キャッシュファイルの削除
export const removeGeocoderCommonDataCache = async (params: {
  cacheDir: string;
}) => {
  const cacheFilePath = path.join(params.cacheDir, 'geocoder-common-data.bin');
  const isExist = fs.existsSync(cacheFilePath);
  if (!isExist) {
    return;
  }
  fs.unlinkSync(cacheFilePath);
}

// ジオコーディングに必要なデータを返す
//
// キャッシュファイルが存在すれば、キャッシュファイルから読み取る
// なければ再作成。
export const loadGeocoderCommonData = async (params: {
  commonDb: ICommonDbGeocode;
  cacheDir: string;
}): Promise<GeocodeWorkerCommonData> => {
  const commonDb = params.commonDb;
  const cacheFilePath = path.join(params.cacheDir, 'geocoder-common-data.bin');
  const isExist = fs.existsSync(cacheFilePath);
  if (isExist) {
    try {
      const encoded = await fs.promises.readFile(cacheFilePath);
      return deserialize(encoded);
    } catch (_: unknown) {
      // Do nothing here
    }
  }
  const [
    prefList,
    countyAndCityList,
    cityAndWardList,
    wardAndOazaList,
    oazaChomes,
    tokyo23towns,
    tokyo23wards,
    wards,
  ]: [
    PrefInfo[],
    CityMatchingInfo[],
    CityMatchingInfo[],
    OazaChoMachingInfo[],
    OazaChoMachingInfo[],
    TownMatchingInfo[],
    CityMatchingInfo[],
    WardMatchingInfo[],
  ] = await Promise.all([
    commonDb.getPrefList(),
    commonDb.getCountyAndCityList(),
    commonDb.getCityAndWardList(),
    commonDb.getWardAndOazaChoList(),
    commonDb.getOazaChomes(),
    commonDb.getTokyo23Towns(),
    commonDb.getTokyo23Wards(),
    commonDb.getWards(),
  ]);

  const cache = {
    prefList,
    countyAndCityList,
    cityAndWardList,
    wardAndOazaList,
    oazaChomes,
    tokyo23towns,
    tokyo23wards,
    wards,
  };

  const buffer = serialize(cache);
  await fs.promises.writeFile(cacheFilePath, buffer);
  return cache;
};
