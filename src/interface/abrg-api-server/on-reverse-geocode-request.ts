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
import { SearchTarget } from "@domain/types/search-target";
import { AbrGeocoder } from "@usecases/geocode/abr-geocoder";
import { StatusCodes } from "http-status-codes";
import { Request, Response } from "hyper-express";

export class OnReverseGeocodeRequest {

  private readonly validSearchTargets;

  constructor(
    private readonly geocoder: AbrGeocoder,
  ) {
    const searchTargets = Array.from(Object.values(SearchTarget));
    this.validSearchTargets = new Set<string>(searchTargets);
  }

  async run(request: Request, response: Response) {
    response.setDefaultEncoding('utf-8');

    const latParam = request.query_parameters['lat'];
    const lonParam = request.query_parameters['lon'];
    const limitParam = request.query_parameters['limit'];
    const targetParam = request.query_parameters['target'];

    if (!latParam) {
      response.status(StatusCodes.BAD_REQUEST, 'lat is required');
      response.json({
        status: 'error',
        message: 'The lat parameter is required',
      });
      return;
    }

    if (!lonParam) {
      response.status(StatusCodes.BAD_REQUEST, 'lon is required');
      response.json({
        status: 'error',
        message: 'The lon parameter is required',
      });
      return;
    }

    const lat = parseFloat(latParam);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      response.status(StatusCodes.BAD_REQUEST, 'lat is invalid');
      response.json({
        status: 'error',
        message: 'The lat parameter must be a number between -90 and 90',
      });
      return;
    }

    const lon = parseFloat(lonParam);
    if (isNaN(lon) || lon < -180 || lon > 180) {
      response.status(StatusCodes.BAD_REQUEST, 'lon is invalid');
      response.json({
        status: 'error',
        message: 'The lon parameter must be a number between -180 and 180',
      });
      return;
    }

    let limit = 1;
    if (limitParam) {
      limit = parseInt(limitParam, 10);
      if (isNaN(limit) || limit < 1 || limit > 5) {
        response.status(StatusCodes.BAD_REQUEST, 'limit is invalid');
        response.json({
          status: 'error',
          message: 'The limit parameter must be an integer between 1 and 5',
        });
        return;
      }
    }

    const searchTarget = (targetParam?.trim() || SearchTarget.ALL) as SearchTarget;
    if (!this.validateTargetOption(searchTarget)) {
      response.status(StatusCodes.BAD_REQUEST, 'target is invalid');
      response.json({
        status: 'error',
        message: 'The target parameter must be one of: all, residential, parcel',
      });
      return;
    }

    const results = await this.geocoder.reverseGeocode({
      lat,
      lon,
      limit,
      searchTarget,
    });

    const geoJsonResponse = {
      type: "FeatureCollection",
      query: {
        lat,
        lon,
        limit,
        target: searchTarget,
      },
      result_info: {
        count: results.length,
        limit,
        api_version: "3.0.0",
        db_version: await this.geocoder.getDbVersion(),
      },
      features: results.map(result => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [parseFloat(result.rep_lon!), parseFloat(result.rep_lat!)],
        },
        properties: {
          formatted_address: result.formatted.address,
          match_level: result.match_level.str,
          distance: result.distance,
          ids: {
            lg_code: result.lg_code || null,
            machiaza_id: result.machiaza_id || null,
            rsdt_addr_flg: result.rsdt_addr_flg ?? null,
            blk_id: result.block_id || null,
            rsdt_id: result.rsdt_id || null,
            rsdt2_id: result.rsdt2_id || null,
            prc_id: result.prc_id || null,
          },
          structured_address: {
            pref: result.pref || null,
            county: result.county || null,
            city: result.city || null,
            ward: result.ward || null,
            oaza_cho: result.oaza_cho || null,
            chome: result.chome || null,
            koaza: result.koaza || null,
            blk_num: result.block || null,
            rsdt_num: result.rsdt_num?.toString() || null,
            rsdt_num2: result.rsdt_num2?.toString() || null,
            prc_num1: result.prc_num1 || null,
            prc_num2: result.prc_num2 || null,
            prc_num3: result.prc_num3 || null,
          },
        },
      })),
    };
    
    response.header('content-type', 'application/geo+json');
    response.send(JSON.stringify(geoJsonResponse));
  }

  private validateTargetOption(value: string): value is SearchTarget {
    return this.validSearchTargets.has(value);
  }
}
