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
import { PackageInfo } from "@domain/services/parse-package-id";
import { ChomeMachingInfo } from "@domain/types/geocode/chome-info";
import { CityInfo, CityMatchingInfo } from "@domain/types/geocode/city-info";
import { KoazaMachingInfo } from "@domain/types/geocode/koaza-info";
import { OazaChoMachingInfo } from "@domain/types/geocode/oaza-cho-info";
import { ParcelInfo } from "@domain/types/geocode/parcel-info";
import { PrefInfo } from "@domain/types/geocode/pref-info";
import { RsdtBlkInfo } from "@domain/types/geocode/rsdt-blk-info";
import { RsdtDspInfo } from "@domain/types/geocode/rsdt-dsp-info";
import { TownInfo, TownMatchingInfo } from "@domain/types/geocode/town-info";
import { WardMatchingInfo } from "@domain/types/geocode/ward-info";

export interface ICommonDbUpdateCheck {
  getLgCodes(): Promise<string[]>;
  hasPrefRows(): Promise<boolean>;
  hasCityRows(packageInfo: PackageInfo): Promise<boolean>;
  hasTownRows(packageInfo: PackageInfo): Promise<boolean>;
  closeDb(): Promise<void>;
}
export interface ICommonDbDownload {
  prefCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  prefPosCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  cityCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  cityPosCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  townCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  townPosCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  // readTown(where: Required<{
  //   lg_code: string;
  //   machiaza_id: string;
  // }>): Promise<TownRow | undefined>;
  closeDb(): Promise<void>;
}

export interface ICommonDbGeocode {
  getPrefList(): Promise<PrefInfo[]>;
  getCityList(): Promise<CityInfo[]>;

  getPrefInfoByKey(pref_key: number): Promise<PrefInfo | undefined>;
  getCityInfoByKey(city_key: number): Promise<CityInfo | undefined>;
  getTownInfoByKey(town_key: number): Promise<TownInfo | undefined>;
  
  getCountyAndCityList(): Promise<CityMatchingInfo[]>;
  getCityAndWardList(): Promise<CityMatchingInfo[]>;

  getTokyo23Towns(): Promise<TownMatchingInfo[]>;
  getWards(): Promise<WardMatchingInfo[]>;
  getTokyo23Wards(): Promise<CityMatchingInfo[]>;
  getWardRows(where: Required<{
    ward: string;
    city_key: number;
  }>): Promise<WardMatchingInfo[]>;

  getOazaChomes(): Promise<OazaChoMachingInfo[]>;

  // getOazaChoPatterns(where: Partial<{
  //   pref_key: number;
  //   city_key: number;
  //   town_key: number;
  // }>): Promise<OazaChoMachingInfo[]>;
  getWardAndOazaChoList(): Promise<OazaChoMachingInfo[]>;

  getChomeRows(where: Partial<{
    pref_key: number;
    city_key: number;
    town_key: number;
    oaza_cho: string;
  }>): Promise<ChomeMachingInfo[]>;

  getKoazaRows(where: Partial<{
    city_key: number;
    oaza_cho: string;
    chome: string;
  }>): Promise<KoazaMachingInfo[]>;
}


export interface IRsdtBlkDbDownload {
  rsdtBlkCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  rsdtBlkPosCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  closeDb(): Promise<void>;
}

export interface IRsdtBlkDbGeocode {
  closeDb(): Promise<void>;
  getBlockNumRows(where: Required<{
    town_key: number;
    blk_num: string; 
  }>): Promise<RsdtBlkInfo[]>;
}


export interface IRsdtDspDbDownload {
  rsdtDspCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  rsdtDspPosCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  closeDb(): Promise<void>;
}

export interface IRsdtDspDbGeocode {
  closeDb(): Promise<void>;
  getRsdtDspRows(where: Required<{
    rsdtblk_key: number;
  }>): Promise<RsdtDspInfo[]>;
}

export interface IParcelDbDownload {
  parcelCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  parcelPosCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  closeDb(): Promise<void>;
}

export interface IParcelDbGeocode {
  closeDb(): Promise<void>;
  getParcelRows(where: Required<{
    city_key: number;
    town_key?: number | null;
    prc_id: string; 
  }>): Promise<ParcelInfo[]>;
}

