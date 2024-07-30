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
import { AbrgError, AbrgErrorLevel } from "@domain/types/messages/abrg-error";
import { CsvTransform } from "./csv-transform";
import { GeoJsonTransform } from "./geo-json-transform";
import { JsonTransform } from "./json-transform";
import { NdGeoJsonTransform } from "./nd-geo-json-transform";
import { NdJsonTransform } from "./nd-json-transform";
import { SimplifiedCsvTransform } from "./simplified-csv-transform";
import { AbrgMessage } from "@domain/types/messages/abrg-message";
import { OutputFormat } from "@domain/types/output-format";

export type CsvOptions = {
  type: 'csv';
  options: {
    columns: string[];
    skipHeader: boolean;
  }
};
export type JsonOptions = {
  type: 'json';
};
export type GeoJsonOptions = {
  type: 'geojson';
};
export type NdJsonOptions = {
  type: 'ndjson';
};
export type NdGeoJsonOptions = {
  type: 'ndgeojson';
};
export type SimplifiedCsvOptions = {
  type: 'simplified';
  options: {
    skipHeader: boolean;
  }
};
export type FormatterProviderOptions = CsvOptions |
  JsonOptions | GeoJsonOptions | NdJsonOptions | 
  NdGeoJsonOptions | SimplifiedCsvOptions;

export class FormatterProvider {
  
  static get(params: {
    type: OutputFormat;
    debug?: boolean;
  }) {
    switch (params.type) {
      case OutputFormat.CSV:
        return new CsvTransform({
          skipHeader: false,
          columns: CsvTransform.DEFAULT_COLUMNS,
          debug: params?.debug,
        });
      case OutputFormat.JSON:
        return new JsonTransform(params);
      case OutputFormat.GEOJSON:
        return new GeoJsonTransform(params);
      case OutputFormat.NDJSON:
        return new NdJsonTransform(params);
      case OutputFormat.NDGEOJSON:
        return new NdGeoJsonTransform(params);
      case OutputFormat.SIMPLIFIED:
        return new SimplifiedCsvTransform({
          skipHeader: false,
        });
      default:
        throw new AbrgError({
          messageId: AbrgMessage.UNSUPPORTED_OUTPUT_FORMAT,
          level: AbrgErrorLevel.ERROR,
        });
    }
  }
}