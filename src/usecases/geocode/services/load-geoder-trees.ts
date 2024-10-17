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
import fs from 'node:fs';
import path from 'node:path';
import { AbrGeocoderDiContainer, AbrGeocoderDiContainerParams } from "../models/abr-geocoder-di-container";
import { CityAndWardTrieFinder } from "../models/city-and-ward-trie-finder";
import { CountyAndCityTrieFinder } from "../models/county-and-city-trie-finder";
import { KyotoStreetTrieFinder } from "../models/kyoto-street-trie-finder";
import { OazaChoTrieFinder } from "../models/oaza-cho-trie-finder";
import { PrefTrieFinder } from "../models/pref-trie-finder";
import { Tokyo23TownTrieFinder } from "../models/tokyo23-town-finder";
import { Tokyo23WardTrieFinder } from "../models/tokyo23-ward-trie-finder";
import { WardAndOazaTrieFinder } from "../models/ward-and-oaza-trie-finder";
import { WardTrieFinder } from "../models/ward-trie-finder";

// キャッシュファイルの削除
export const removeGeocoderCaches = async (params: {
  cacheDir: string;
}) => {
  const isExist = fs.existsSync(params.cacheDir);
  if (!isExist) {
    return;
  }
  for await (const dirent of await fs.promises.opendir(params.cacheDir)) {
    if (!dirent.isFile) {
      continue;
    }
    fs.unlinkSync(path.join(params.cacheDir, dirent.name));
  }
};

// ジオコーディングに必要なデータを返す
//
// キャッシュファイルが存在すれば、キャッシュファイルから読み取る
// なければ再作成。
export const loadGeocoderTrees = async (params: AbrGeocoderDiContainerParams) => {

  const container = new AbrGeocoderDiContainer(params);
  const [
    prefTrie,
    countyAndCityTrie,
    cityAndWardTrie,
    kyotoStreetTrie,
    oazaChoTrie,
    wardAndOazaTrie,
    wardTrie,
    tokyo23WardTrie,
    tokyo23TownTrie,
  ]: [
    PrefTrieFinder,
    CountyAndCityTrieFinder,
    CityAndWardTrieFinder,
    KyotoStreetTrieFinder,
    OazaChoTrieFinder,
    WardAndOazaTrieFinder,
    WardTrieFinder,
    Tokyo23WardTrieFinder,
    Tokyo23TownTrieFinder,
  ] = await Promise.all([
    PrefTrieFinder.create(container),
    CountyAndCityTrieFinder.create(container),
    CityAndWardTrieFinder.create(container),
    KyotoStreetTrieFinder.create(container),
    OazaChoTrieFinder.create(container),
    WardAndOazaTrieFinder.create(container),
    WardTrieFinder.create(container),
    Tokyo23WardTrieFinder.create(container),
    Tokyo23TownTrieFinder.create(container),
  ]);

  return {
    prefTrie,
    countyAndCityTrie,
    cityAndWardTrie,
    kyotoStreetTrie,
    oazaChoTrie,
    wardAndOazaTrie,
    wardTrie,
    tokyo23WardTrie,
    tokyo23TownTrie,
  };
};
