/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
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
import {Hono} from 'hono'
import {AbrGeocoder} from "@usecases/geocode/abr-geocoder";
import {SearchTarget} from "@domain/types/search-target";
import {OutputFormat} from "@domain/types/output-format";
import {cors} from 'hono/cors'
import {poweredBy} from 'hono/powered-by'
import {D1Database} from "@cloudflare/workers-types";

import {geocode} from "@usecases/geocode-cf-workers/abr-geocoder-cf-workers";
import {GeocodeWorkerD1Controller} from "@interface/database/D1/geocode-worker-d1-controller";
import {BLANK_CHAR} from "@config/constant-values";

export const app = new Hono<{
  Bindings: {
    DB: D1Database
  }
}>()

app.use(cors())
app.use(poweredBy())

const isSearchTarget = (target: string): target is SearchTarget => {
  return Object.values(SearchTarget).includes(target as SearchTarget);
}

const isFormat = (format: string): format is OutputFormat => {
  return Object.values(OutputFormat).includes(format as OutputFormat);
}

app.get('/geocode', async (c) => {

  const {address, target = SearchTarget.ALL, fuzzy, format = "json"} = c.req.query();
  if (!address) {
    return c.json({
      status: 'error',
      message: 'The address paramaeter is empty',
    }, {
      status: 400,
      statusText: "address is empty"
    });
  }
  if (!isSearchTarget(target)) {
    return c.json({
      status: 'error',
      message: 'The target paramaeter is invalid',
    }, {
      status: 400,
      statusText: "target is invalid"
    });
  }
  if (fuzzy && fuzzy.length !== 1) {
    return c.json({
      status: 'error',
      message: 'The fuzzy paramaeter is invalid',
    }, {
      status: 400,
      statusText: "fuzzy is invalid"
    });
  }

  if (!isFormat(format)) {
    return c.json({
      status: 'error',
      message: 'The format paramaeter is invalid',
    }, {
      status: 400,
      statusText: "format is invalid"
    });
  }

  const databaseController = new GeocodeWorkerD1Controller({
    connectParams: {
      type: "d1",
      d1Client: c.env.DB,
    }
  });
  const result = await geocode({
    address,
    searchTarget: target,
    fuzzy,
    dbCtrl: databaseController,
  })
  return c.json({
    query: {
      input: result.input.data.address
    },
    result: {
      output: result.formatted.address,
      other: result.tempAddress?.toOriginalString() || BLANK_CHAR,
      score: result.formatted.score,
      match_level: result.match_level.str,
      coordinate_level: result.coordinate_level.str,
      lat: result.rep_lat,
      lon: result.rep_lon,
      lg_code: result.lg_code ? result.lg_code : BLANK_CHAR,
      machiaza_id: result.machiaza_id || BLANK_CHAR,
      rsdt_addr_flg: result.rsdt_addr_flg,
      blk_id: result.block_id || BLANK_CHAR,
      rsdt_id: result.rsdt_id || BLANK_CHAR,
      rsdt2_id: result.rsdt2_id || BLANK_CHAR,
      prc_id: result.prc_id || BLANK_CHAR,
      pref: result.pref || BLANK_CHAR,
      county: result.county || BLANK_CHAR,
      city: result.city || BLANK_CHAR,
      ward: result.ward || BLANK_CHAR,
      oaza_cho: result.oaza_cho || BLANK_CHAR,
      chome: result.chome || BLANK_CHAR,
      koaza: result.koaza || BLANK_CHAR,
      blk_num: result.block?.toString() || BLANK_CHAR,
      rsdt_num: result.rsdt_num || BLANK_CHAR,
      rsdt_num2: result.rsdt_num2 || BLANK_CHAR,
      prc_num1: result.prc_num1?.toString() || BLANK_CHAR,
      prc_num2: result.prc_num2?.toString() || BLANK_CHAR,
      prc_num3: result.prc_num3?.toString() || BLANK_CHAR,
    },
  })
})

export default app
