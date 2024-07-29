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