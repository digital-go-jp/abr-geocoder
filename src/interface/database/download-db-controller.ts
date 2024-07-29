
import { DatabaseParams } from "@domain/types/database-params";
import path from "node:path";
import { ICommonDbDownload, IParcelDbDownload, IRsdtBlkDbDownload, IRsdtDspDbDownload } from "./common-db";
import { CommonDbDownloadSqlite3 } from "./sqlite3/download/common-db-download-sqlite3";
import { ParcelDbDownloadSqlite3 } from "./sqlite3/download/parcel-db-download-sqlite3";
import { RsdtBlkDbDownloadSqlite3 } from "./sqlite3/download/rsdt-blk-db-download-sqlite3";
import { RsdtDspDownloadSqlite3 } from "./sqlite3/download/rsdt-dsp-db-sqlite3";
import { Sqlite3Util } from "./sqlite3/sqlite3-util";

export class DownloadDbController {
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

  async openCommonDb(): Promise<ICommonDbDownload> {
    switch(this.connectParams.type) {
      case 'sqlite3':
        return new CommonDbDownloadSqlite3({
          sqliteFilePath: path.join(this.connectParams.dataDir, 'common.sqlite'),
          schemaFilePath: path.join(this.connectParams.schemaDir, 'schema-common.sql'),
          readonly: false,
        });
      
      default:
        throw 'Not implemented';
    }
  }

  async openRsdtBlkDb(params: Required<{
    lg_code: string;
    createIfNotExists: boolean;
  }>): Promise<IRsdtBlkDbDownload | null> {
    switch(this.connectParams.type) {
      case 'sqlite3':
        const hasTheDbFile = this.sqlite3Util?.hasExtraDb({
          lg_code: params.lg_code,
        });
        if (!hasTheDbFile && !params.createIfNotExists) {
          return null;
        }

        return new RsdtBlkDbDownloadSqlite3({
          sqliteFilePath: path.join(this.connectParams.dataDir, `abrg-${params.lg_code}.sqlite`),
          schemaFilePath: path.join(this.connectParams.schemaDir, 'schema-lgcode.sql'),
          readonly: false,
        });

      default:
        throw 'Not implemented';
    }
  }

  async openRsdtDspDb(params: Required<{
    lg_code: string;
    createIfNotExists: boolean;
  }>): Promise<IRsdtDspDbDownload | null> {
    switch (this.connectParams.type) {
      case 'sqlite3':
        const hasTheDbFile = this.sqlite3Util?.hasExtraDb({
          lg_code: params.lg_code,
        });
        if (!hasTheDbFile && !params.createIfNotExists) {
          return null;
        }

        return new RsdtDspDownloadSqlite3({
          sqliteFilePath: path.join(this.connectParams.dataDir, `abrg-${params.lg_code}.sqlite`),
          schemaFilePath: path.join(this.connectParams.schemaDir, 'schema-lgcode.sql'),
          readonly: false,
        });

      default:
        throw 'Not implemented';
    }
  }

  async openParcelDb(params: Required<{
    lg_code: string;
    createIfNotExists: boolean;
  }>): Promise<IParcelDbDownload | null> {
    switch (this.connectParams.type) {
      case 'sqlite3':
        const hasTheDbFile = this.sqlite3Util?.hasExtraDb({
          lg_code: params.lg_code,
        });
        if (!hasTheDbFile && !params.createIfNotExists) {
          return null;
        }

        return new ParcelDbDownloadSqlite3({
          sqliteFilePath: path.join(this.connectParams.dataDir, `abrg-${params.lg_code}.sqlite`),
          schemaFilePath: path.join(this.connectParams.schemaDir, 'schema-lgcode.sql'),
          readonly: false,
        });

      default:
        throw 'Not implemented';
    }
  }
}