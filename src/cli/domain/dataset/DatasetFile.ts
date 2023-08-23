import { Statement } from "better-sqlite3";
import { DataField } from "./DataField";
import {
  DatasetFileParams,
  DatasetWithDateParams,
  IDatasetFile,
  IDatasetFileMeta,
} from './types';
import { Stream } from "node:stream";
import { TransformCallback } from "stream";
import proj4 from "proj4";
import { parse } from "node:path";

export abstract class DatasetFile implements IDatasetFile {
  public readonly type: string;
  public readonly fileArea: string;
  public readonly path: string;
  public readonly filename: string;
  public readonly sql: string;
  public readonly indexCols: number;
  public readonly inputStream: NodeJS.ReadableStream;

  abstract get fields(): DataField[];

  private indicies: Record<string, number> = {}

  protected constructor(params: DatasetFileParams) {
    this.type = params.type;
    this.fileArea = params.fileArea;
    this.path = params.path;
    this.filename = params.filename;
    this.sql = params.sql;
    this.indexCols = params.indexCols;
    this.inputStream = params.inputStream;
  }

  abstract process(rows: {[key:string]: string}): Record<string, string | number>;

  parseHeaderLine(line: string[]) {
    // CSVファイル1行目はヘッダーなので、分析する
    line.forEach((column: string, index: number) => {
      this.indicies[column.toUpperCase()] = index;
    });
  }

  getFieldIndex(field: DataField): number {
    if (!(field.csv in this.indicies)) {
      throw new Error(`can not find ${field.csv} in the dataset csv file`);
    }
    return this.indicies[field.csv];
  }

  parseFields(row: {[key:string]: string}): Record<string, string | number> {

    const result: Record<string, string | number> = {};
    this.fields.forEach(field => {
      result[field.dbColumn] = row[field.csv] as string;
    })
    return result;
  }

  // parseFields(line: string[]): Record<string, string | number> {

  //   const parsedRow: Record<string, string | number> = {};
  //   this.fields.forEach(field => {
  //     if (!(field.csv in this.indicies)) {
  //       throw new Error(`can not find ${field.csv} in the dataset csv file`);
  //     }
  //     const colIdx = this.indicies[field.csv];
  //     parsedRow[field.dbColumn] = line[colIdx];
  //   });

  //   return parsedRow;
  // }
}
export abstract class DataWithDateFile extends DatasetFile implements IDatasetFileMeta {
  public readonly validDateCol: number;

  protected constructor(params: DatasetWithDateParams) {
    super(params)
    this.validDateCol = params.validDateCol;
  }

  process(row: {[key:string]: string}): Record<string, string | number> {
    return this.parseFields(row);
/*
    // CSVファイル1行目はヘッダーなので、分析する
    this.parseHeaderLine(rows[0]);

    // このあたりのコードは、オリジナルコードをキープ
    // 日付が異なるのに同じデータが連続した行にあったら、古いデータを捨てて、新しいデータのみをキープらしい
    //
    // オリジナルコードを
    // https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/downloader.ts#L319-L345

    let prevIndexKey: string | undefined;
    let prevValidDate: string | undefined;
    const results: Record<string, string | number>[] = [];
    for (let i = 1; i < rows.length; i++) {
      const line = rows[i];
      const indexKey = [
        ...line.slice(0, this.indexCols),
      ].join('|');

      const newRow = line;

      if (prevIndexKey === indexKey) {
        if (!prevValidDate || prevValidDate >= newRow[this.validDateCol]) {
          // because the last entry of the rows array is newer than the one we are about to insert, we
          // will skip this one because the one in the array is already valid.
          continue;
        }
        // because the last entry of the rows array is older than the one we are about to insert, we
        // will pop it off and replace it with the newRow
        results.pop();
      }

      const parsedRow = this.parseFields(newRow);
      results.push(parsedRow);
      
      prevIndexKey = indexKey;
      prevValidDate = newRow[this.validDateCol];
    }
    return results;
  */
  }
}

export abstract class DataForPosFile extends DatasetFile implements IDatasetFileMeta {

  protected constructor(params: DatasetFileParams) {
    super(params)
  }

  process(row: {[key: string]: string}): Record<string, string | number> {

    // CSVファイル1行目はヘッダーなので、分析する
    // this.parseHeaderLine(rows[0]);

    // const crsIdx = this.getFieldIndex(DataField.REP_PNT_SRID);

    const parsedRow = this.parseFields(row);

    // 座標系の変換
    const [longitude, latitude] = proj4(
      row['代表点_座標参照系'], // from
      'EPSG:4326', // to
      [
        parseFloat(parsedRow[DataField.REP_PNT_LON.dbColumn] as string),
        parseFloat(parsedRow[DataField.REP_PNT_LAT.dbColumn] as string),
      ],
    );
    
    parsedRow[DataField.REP_PNT_LON.dbColumn] = longitude;
    parsedRow[DataField.REP_PNT_LAT.dbColumn] = latitude;
  
    return parsedRow;
  }
}