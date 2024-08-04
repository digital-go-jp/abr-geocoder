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
import { CityDatasetFile } from "@domain/models/city-dataset-file";
import { CityPosDatasetFile } from "@domain/models/city-pos-dataset-file";
import { ParcelDatasetFile } from "@domain/models/parcel-dataset-file";
import { ParcelPosDatasetFile } from "@domain/models/parcel-pos-dataset-file";
import { PrefDatasetFile } from "@domain/models/pref-dataset-file";
import { PrefPosDatasetFile } from "@domain/models/pref-pos-dataset-file";
import { RsdtdspBlkFile } from "@domain/models/rsdt-blk-file";
import { RsdtdspBlkPosFile } from "@domain/models/rsdt-blk-pos-file";
import { RsdtDspFile } from "@domain/models/rsdt-dsp-file";
import { RsdtDspPosFile } from "@domain/models/rsdt-dsp-pos-file";
import { TownDatasetFile } from "@domain/models/town-dataset-file";
import { TownPosDatasetFile } from "@domain/models/town-pos-dataset-file";
import { FileGroupKey } from "@domain/types/download/file-group";
import { RegExpEx } from "./reg-exp-ex";

const datasetTypes = new Map<string, FileGroupKey>([
  [PrefDatasetFile.CKAN_PACKAGE_ID, 'pref'],
  [PrefPosDatasetFile.CKAN_PACKAGE_ID, 'pref_pos'],
  [CityDatasetFile.CKAN_PACKAGE_ID, 'city'],
  [CityPosDatasetFile.CKAN_PACKAGE_ID, 'city_pos'],
  [TownDatasetFile.CKAN_PACKAGE_ID, 'town'],
  [TownPosDatasetFile.CKAN_PACKAGE_ID, 'town_pos'],
  [RsdtdspBlkFile.CKAN_PACKAGE_ID, 'rsdtdsp_blk'],
  [RsdtdspBlkPosFile.CKAN_PACKAGE_ID, 'rsdtdsp_blk_pos'],
  [RsdtDspFile.CKAN_PACKAGE_ID, 'rsdtdsp_rsdt'],
  [RsdtDspPosFile.CKAN_PACKAGE_ID, 'rsdtdsp_rsdt_pos'],
  [ParcelDatasetFile.CKAN_PACKAGE_ID, 'parcel'],
  [ParcelPosDatasetFile.CKAN_PACKAGE_ID, 'parcel_pos'],
]);

export type PackageInfo = {
  lgCode: string;
  dataset: FileGroupKey;
  packageId: string;
}
export const parsePackageId = (packageId: string): PackageInfo | undefined => {
  
  const elements = packageId.split(RegExpEx.create('[_\\-]'));
    if (
        // パターンマッチしないパッケージID
        elements.length !== 5 ||

        elements[0] !== 'ba' ||
        elements[1] !== 'o1' ||
        elements[3] !== 'g2' ||
      
        // 対象外のパッケージタイプ
        !datasetTypes.has(elements[4])
      ) {
      return;
    }

    const lgCode = elements[2];
    const dataset = datasetTypes.get(elements[4])!;
    return {
      lgCode,
      dataset,
      packageId,
    };
}