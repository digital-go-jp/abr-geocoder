/*!
 * MIT License
 *
 * Copyright (c) 2024 NEKOYASAN
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
import {SearchTarget} from "@domain/types/search-target";
import {GeocodeWorkerD1Controller} from "@interface/database/D1/geocode-worker-d1-controller";
import {prefTransform} from "@usecases/geocode-cf-workers/steps/pref-transform";
import {normalizeTransform} from "@usecases/geocode-cf-workers/steps/normalize-transform";
import {countyAndCityTransform} from "@usecases/geocode-cf-workers/steps/county-and-city-transform";
import {cityAndWardTransform} from "@usecases/geocode-cf-workers/steps/city-and-ward-transform";
import {wardAndOazaTransform} from "@usecases/geocode-cf-workers/steps/ward-and-oaza-transform";
import {wardTransform} from "@usecases/geocode-cf-workers/steps/ward-transform";
import {tokyo23TownTransform} from "@usecases/geocode-cf-workers/steps/tokyo23town-transform";
import {tokyo23WardTransform} from "@usecases/geocode-cf-workers/steps/tokyo23ward-transform";
import {oazaChomeTransform} from "@usecases/geocode-cf-workers/steps/oaza-chome-transform";
import {chomeTransform} from "@usecases/geocode-cf-workers/steps/chome-transform";
import {koazaTransform} from "@usecases/geocode-cf-workers/steps/koaza-transform";
import {rsdtBlkTransform} from "@usecases/geocode-cf-workers/steps/rsdt-blk-transform";
import {rsdtDspTransform} from "@usecases/geocode-cf-workers/steps/rsdt-dsp-transform";
import {parcelTransform} from "@usecases/geocode-cf-workers/steps/parcel-transform";
import {regexTransform} from "@usecases/geocode-cf-workers/steps/regex-transform";
import {geocodeResultTransform} from "@usecases/geocode-cf-workers/steps/geocode-result-transform";
import {Query} from "@usecases/geocode/models/query";

export type AbrGeocoderCloudflareWorkersInput = {
    address: string;
    searchTarget: SearchTarget;
    fuzzy?: string | undefined;
    dbCtrl: GeocodeWorkerD1Controller;
};

export const geocode = async ({
    address,
    searchTarget,
    fuzzy,
    dbCtrl,
}: AbrGeocoderCloudflareWorkersInput): Promise<Query> => {
    const commonDb = await dbCtrl.openCommonDb();

    const queryies = await normalizeTransform({
        address,
        searchTarget,
        fuzzy,
    });

    const prefTransformed = await prefTransform(commonDb, queryies);
    const countyAndCityTransformed = await countyAndCityTransform(commonDb, prefTransformed);
    const cityAndWardTransformed = await cityAndWardTransform(commonDb, countyAndCityTransformed);
    const wardAndOazaTransformed = await wardAndOazaTransform(commonDb, cityAndWardTransformed);
    const wardTransformed = await wardTransform(commonDb, wardAndOazaTransformed);
    const tokyo23TownTransformed = await tokyo23TownTransform(commonDb, wardTransformed);
    const tokyo23WardTransformed = await tokyo23WardTransform(commonDb, tokyo23TownTransformed);
    const oazaChomeTransformed = await oazaChomeTransform(commonDb, tokyo23WardTransformed);
    const chomeTransformed = await chomeTransform(commonDb, oazaChomeTransformed);
    const koazaTransformed = await koazaTransform(commonDb, chomeTransformed);
    const rsdtBlkTransformed = await rsdtBlkTransform(dbCtrl, koazaTransformed);
    const rsdtDspTransformed = await rsdtDspTransform(dbCtrl, rsdtBlkTransformed);
    const parcelTransformed = await parcelTransform(dbCtrl, rsdtDspTransformed);
    const regexTransformed = await regexTransform(parcelTransformed);
    const geocodeResultTransformed = await geocodeResultTransform(regexTransformed);
    return geocodeResultTransformed;
}
