import proj4 from 'proj4';
import {DataField} from './DataField';
import {DatasetFileParams, IDatasetFile, IDatasetFileMeta} from './types';

proj4.defs('EPSG:4612', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');
proj4.defs('EPSG:6668', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');

export abstract class DatasetFile implements IDatasetFile {
  public readonly type: string;
  public readonly fileArea: string;
  public readonly path: string;
  public readonly filename: string;
  public readonly sql: string;
  public readonly inputStream: NodeJS.ReadableStream;

  abstract get fields(): DataField[];

  protected constructor(params: DatasetFileParams) {
    this.type = params.type;
    this.fileArea = params.fileArea;
    this.path = params.path;
    this.filename = params.filename;
    this.sql = params.sql;
    this.inputStream = params.inputStream;
  }

  abstract process(rows: {
    [key: string]: string;
  }): Record<string, string | number>;

  // CSVのフィールド名をDBカラム名に変換する
  parseFields(row: {[key: string]: string}): Record<string, string | number> {
    const result: Record<string, string | number> = {};
    this.fields.forEach(field => {
      result[field.dbColumn] = row[field.csv] as string;
    });
    return result;
  }
}
export abstract class DataWithDateFile
  extends DatasetFile
  implements IDatasetFileMeta
{
  process(row: {[key: string]: string}): Record<string, string | number> {
    return this.parseFields(row);
  }
}

export abstract class DataForPosFile
  extends DatasetFile
  implements IDatasetFileMeta
{
  process(row: {[key: string]: string}): Record<string, string | number> {
    const parsedRow = this.parseFields(row);

    // 座標系の変換
    const lat = parseFloat(parsedRow[DataField.REP_PNT_LAT.dbColumn] as string);
    const lon = parseFloat(parsedRow[DataField.REP_PNT_LON.dbColumn] as string);
    const extra = row['代表点_座標参照系'];
    const [longitude, latitude] = proj4(
      extra, // from
      'WGS84' // to
    ).forward([lon, lat]);

    parsedRow[DataField.REP_PNT_LON.dbColumn] = longitude;
    parsedRow[DataField.REP_PNT_LAT.dbColumn] = latitude;

    return parsedRow;
  }
}
