
import { DatabaseParams } from "@domain/types/database-params";
import path from "node:path";
import { ICommonDbGeocode, IParcelDbGeocode, IRsdtBlkDbGeocode, IRsdtDspDbGeocode } from "./common-db";
import { CommonDbGeocodeSqlite3 } from "./sqlite3/geocode/common-db-geocode-sqlite3";
import { ParcelDbGeocodeSqlite3 } from "./sqlite3/geocode/parcel-db-geocode-sqlite3";
import { RsdtBlkGeocodeSqlite3 } from "./sqlite3/geocode/rsdt-blk-db-geocode-sqlite3";
import { RsdtDspGeocodeSqlite3 } from "./sqlite3/geocode/rsdt-dsp-db-geocode-sqlite3";
import { Sqlite3Util } from "./sqlite3/sqlite3-util";

export class GeocodeDbController {
  private readonly sqlite3Util?: Sqlite3Util;
  public readonly connectParams: DatabaseParams;

  constructor(params: Required<{
    connectParams: DatabaseParams,
  }>) {
    this.connectParams = params.connectParams;

    switch (this.connectParams.type) {
      case 'sqlite3':
        this.sqlite3Util = new Sqlite3Util({
          dataDir: this.connectParams.dataDir,
        });
        break;

      default:
        // Do nothing here
        break;
    }
  }

  async openCommonDb(): Promise<ICommonDbGeocode> {
    switch(this.connectParams.type) {
      case 'sqlite3':
        return new CommonDbGeocodeSqlite3({
          sqliteFilePath: path.join(this.connectParams.dataDir, 'common.sqlite'),
          schemaFilePath: path.join(this.connectParams.schemaDir, 'schema-common.sql'),
          readonly: true,
        });
      
      default:
        throw 'Not implemented';
    }
  }

  async openRsdtBlkDb(params: Required<{
    lg_code: string;
    createIfNotExists: boolean;
  }>): Promise<IRsdtBlkDbGeocode | null> {
    switch(this.connectParams.type) {
      case 'sqlite3':
        const hasTheDbFile = this.sqlite3Util?.hasExtraDb({
          lg_code: params.lg_code,
        });
        if (!hasTheDbFile && !params.createIfNotExists) {
          return null;
        }

        return new RsdtBlkGeocodeSqlite3({
          sqliteFilePath: path.join(this.connectParams.dataDir, `abrg-${params.lg_code}.sqlite`),
          schemaFilePath: path.join(this.connectParams.schemaDir, 'schema-lgcode.sql'),
          readonly: true,
        });

      default:
        throw 'Not implemented';
    }
  }

  async openRsdtDspDb(params: Required<{
    lg_code: string;
    createIfNotExists: boolean;
  }>): Promise<IRsdtDspDbGeocode | null> {
    switch (this.connectParams.type) {
      case 'sqlite3':
        const hasTheDbFile = this.sqlite3Util?.hasExtraDb({
          lg_code: params.lg_code,
        });
        if (!hasTheDbFile && !params.createIfNotExists) {
          return null;
        }

        return new RsdtDspGeocodeSqlite3({
          sqliteFilePath: path.join(this.connectParams.dataDir, `abrg-${params.lg_code}.sqlite`),
          schemaFilePath: path.join(this.connectParams.schemaDir, 'schema-lgcode.sql'),
          readonly: true,
        });

      default:
        throw 'Not implemented';
    }
  }

  async openParcelDb(params: Required<{
    lg_code: string;
    createIfNotExists: boolean;
  }>): Promise<IParcelDbGeocode | null> {
    switch (this.connectParams.type) {
      case 'sqlite3':
        const hasTheDbFile = this.sqlite3Util?.hasExtraDb({
          lg_code: params.lg_code,
        });
        if (!hasTheDbFile && !params.createIfNotExists) {
          return null;
        }

        return new ParcelDbGeocodeSqlite3({
          sqliteFilePath: path.join(this.connectParams.dataDir, `abrg-${params.lg_code}.sqlite`),
          schemaFilePath: path.join(this.connectParams.schemaDir, 'schema-lgcode.sql'),
          readonly: true,
        });

      default:
        throw 'Not implemented';
    }
  }
}