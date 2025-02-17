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
import { ParcelInfo } from "@domain/types/geocode/parcel-info";
import { PrefInfo } from "@domain/types/geocode/pref-info";
import { RsdtBlkInfo } from "@domain/types/geocode/rsdt-blk-info";
import { RsdtDspInfo } from "@domain/types/geocode/rsdt-dsp-info";
import { TownMatchingInfo } from "@domain/types/geocode/town-info";
import { WardMatchingInfo } from "@domain/types/geocode/ward-info";
import { WardAndOazaMatchingInfo } from "@domain/types/geocode/ward-oaza-info";


export interface ICommonDbDataset {
  getLgCodes(): Promise<string[]>;
  hasPrefRows(): Promise<boolean>;
  hasCityRows(packageInfo: PackageInfo): Promise<boolean>;
  hasTownRows(packageInfo: PackageInfo): Promise<boolean>;
  close(): Promise<void>
}

export interface ICommonDbUpdateCheck {
  getLgCodes(): Promise<string[]>;
  hasPrefRows(): Promise<boolean>;
  hasCityRows(packageInfo: PackageInfo): Promise<boolean>;
  hasTownRows(packageInfo: PackageInfo): Promise<boolean>;
  close(): Promise<void>
}
export interface ICommonDbDownload {
  prefCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  prefPosCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  cityCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  cityPosCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  townCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  townPosCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  close(): Promise<void>
}

export interface ICommonDbGeocode {
  getPrefList(): Promise<PrefInfo[]>;
  getPrefListGeneratorHash(): string;

  getCityList(): Promise<CityInfo[]>;
  getCityListGeneratorHash(): string;

  getCountyAndCityList(): Promise<CityMatchingInfo[]>;
  getCountyAndCityListGeneratorHash(): string;

  getCityAndWardList(): Promise<CityMatchingInfo[]>;
  getCityAndWardListGeneratorHash(): string;
  
  getTokyo23Towns(): Promise<TownMatchingInfo[]>;
  getTokyo23TownsGeneratorHash(): string;
  
  getWards(): Promise<WardMatchingInfo[]>;
  getWardsGeneratorHash(): string;

  getTokyo23Wards(): Promise<CityMatchingInfo[]>;
  getTokyo23WardsGeneratorHash(): string;
  
  getOazaChomes(params: {
    lg_code: string;
  }): Promise<TownMatchingInfo[]>;
  getOazaChomesGeneratorHash(): string;

  getKyotoStreetRows(): Promise<KoazaMachingInfo[]>;
  getKyotoStreetGeneratorHash() : string;

  getWardAndOazaChoList(): Promise<WardAndOazaMatchingInfo[]>;
  getWardAndOazaChoListGeneratorHash(): string;

  getChomeRows(where: Partial<{
    pref_key: number;
    city_key: number;
    town_key: number;
    oaza_cho: string;
  }>): Promise<ChomeMachingInfo[]>;
  close(): Promise<void>
}

export interface IRsdtBlkDbDownload {
  rsdtBlkCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  rsdtBlkPosCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  close(): Promise<void>
}

export type GetBlockNumRowsOptions = {
  town_key: number;
  blk_num: string; 
};

export interface IRsdtBlkDbGeocode {
  getBlockNumRows(where?: GetBlockNumRowsOptions): Promise<RsdtBlkInfo[]>;
  close(): Promise<void>
}

export interface IRsdtDspDbDownload {
  rsdtDspCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  rsdtDspPosCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  close(): Promise<void>
}

export type GetRsdtDspRows = {
  rsdtblk_key: number;
};

export interface IRsdtDspDbGeocode {
  getRsdtDspRows(where?: GetRsdtDspRows): Promise<RsdtDspInfo[]>;
  close(): Promise<void>
}

export interface IParcelDbDownload {
  parcelCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  parcelPosCsvRows(rows: Record<string, string | number>[]): Promise<void>;
  close(): Promise<void>
}

export type GetParcelRowsOptions = {
  town_key?: number | null;
  prc_id: string; 
};

export interface IParcelDbGeocode {
  getParcelRows(where?: GetParcelRowsOptions): Promise<ParcelInfo[]>;
  close(): Promise<void>
}
