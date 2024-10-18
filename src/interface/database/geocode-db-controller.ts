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
import { AbrgError, AbrgErrorLevel } from "@domain/types/messages/abrg-error";
import { AbrgMessage } from "@domain/types/messages/abrg-message";
import path from "node:path";
import { ICommonDbGeocode, IParcelDbGeocode, IRsdtBlkDbGeocode, IRsdtDspDbGeocode } from "./common-db";
import { CommonDbGeocodeSqlite3 } from "./sqlite3/geocode/common-db-geocode-sqlite3";
import { ParcelDbGeocodeSqlite3 } from "./sqlite3/geocode/parcel-db-geocode-sqlite3";
import { RsdtBlkGeocodeSqlite3 } from "./sqlite3/geocode/rsdt-blk-db-geocode-sqlite3";
import { RsdtDspGeocodeSqlite3 } from "./sqlite3/geocode/rsdt-dsp-db-geocode-sqlite3";
import { Sqlite3Util } from "./sqlite3/sqlite3-util";

export type GeocodeDbControllerOptions = {
  connectParams: DatabaseParams,
};

export class GeocodeDbController {
  private readonly sqlite3Util?: Sqlite3Util;
  public readonly connectParams: DatabaseParams;

  constructor(params: Required<GeocodeDbControllerOptions>) {
    this.connectParams = params.connectParams;

    switch (this.connectParams.type) {
      case 'sqlite3': {
        this.sqlite3Util = new Sqlite3Util({
          dataDir: this.connectParams.dataDir,
        });
        break;
      }

      default:
        throw new AbrgError({
          messageId: AbrgMessage.NOT_IMPLEMENTED,
          level: AbrgErrorLevel.ERROR,
        });
    }
  }

  openCommonDb(): Promise<ICommonDbGeocode> {
    switch(this.connectParams.type) {
      case 'sqlite3': {
        return Promise.resolve(new CommonDbGeocodeSqlite3({
          sqliteFilePath: path.join(this.connectParams.dataDir, 'common.sqlite'),
          schemaFilePath: path.join(this.connectParams.schemaDir, 'schema-common.sql'),
          readonly: true,
        }));
      }
      
      default:
        throw new AbrgError({
          messageId: AbrgMessage.NOT_IMPLEMENTED,
          level: AbrgErrorLevel.ERROR,
        });
    }
  }

  openRsdtBlkDb(params: Required<{
    lg_code: string;
    createIfNotExists: boolean;
  }>): Promise<IRsdtBlkDbGeocode | null> {
    switch(this.connectParams.type) {
      case 'sqlite3': {
        const hasTheDbFile = this.sqlite3Util?.hasExtraDb({
          lg_code: params.lg_code,
        });
        if (!hasTheDbFile && !params.createIfNotExists) {
          return Promise.resolve(null);
        }

        return Promise.resolve(new RsdtBlkGeocodeSqlite3({
          sqliteFilePath: path.join(this.connectParams.dataDir, `abrg-${params.lg_code}.sqlite`),
          schemaFilePath: path.join(this.connectParams.schemaDir, 'schema-lgcode.sql'),
          readonly: true,
        }));
      }

      default:
        throw new AbrgError({
          messageId: AbrgMessage.NOT_IMPLEMENTED,
          level: AbrgErrorLevel.ERROR,
        });
    }
  }

  openRsdtDspDb(params: Required<{
    lg_code: string;
    createIfNotExists: boolean;
  }>): Promise<IRsdtDspDbGeocode | null> {
    switch (this.connectParams.type) {
      case 'sqlite3': {
        const hasTheDbFile = this.sqlite3Util?.hasExtraDb({
          lg_code: params.lg_code,
        });
        if (!hasTheDbFile && !params.createIfNotExists) {
          return Promise.resolve(null);
        }

        return Promise.resolve(new RsdtDspGeocodeSqlite3({
          sqliteFilePath: path.join(this.connectParams.dataDir, `abrg-${params.lg_code}.sqlite`),
          schemaFilePath: path.join(this.connectParams.schemaDir, 'schema-lgcode.sql'),
          readonly: true,
        }));
      }

      default: {
        throw new AbrgError({
          messageId: AbrgMessage.NOT_IMPLEMENTED,
          level: AbrgErrorLevel.ERROR,
        });
      }
    }
  }

  openParcelDb(params: Required<{
    lg_code: string;
    createIfNotExists: boolean;
  }>): Promise<IParcelDbGeocode | null> {
    switch (this.connectParams.type) {
      case 'sqlite3': {
        const hasTheDbFile = this.sqlite3Util?.hasExtraDb({
          lg_code: params.lg_code,
        });
        if (!hasTheDbFile && !params.createIfNotExists) {
          return Promise.resolve(null);
        }

        return Promise.resolve(new ParcelDbGeocodeSqlite3({
          sqliteFilePath: path.join(this.connectParams.dataDir, `abrg-${params.lg_code}.sqlite`),
          schemaFilePath: path.join(this.connectParams.schemaDir, 'schema-lgcode.sql'),
          readonly: true,
        }));
      }

      default:
        throw new AbrgError({
          messageId: AbrgMessage.NOT_IMPLEMENTED,
          level: AbrgErrorLevel.ERROR,
        });
    }
  }
}
