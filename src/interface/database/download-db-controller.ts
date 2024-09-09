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
