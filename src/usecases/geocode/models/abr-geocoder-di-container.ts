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
import { CommonDiContainer } from '@domain/models/common-di-container';
import { DebugLogger } from '@domain/services/logger/debug-logger';
import { DatabaseParams } from '@domain/types/database-params';
import { SearchTarget } from '@domain/types/search-target';
import { GeocodeDbController } from '@interface/database/geocode-db-controller';

export type AbrGeocoderDiContainerParams = {
  database: DatabaseParams;
  debug: boolean;
};

export class AbrGeocoderDiContainer extends CommonDiContainer {

  public readonly searchTarget?: SearchTarget;
  public readonly database: GeocodeDbController;
  public readonly logger?: DebugLogger;

  constructor(private params: AbrGeocoderDiContainerParams) {
    super();
    this.database = new GeocodeDbController({
      connectParams: params.database,
    });
    if (params.debug) {
      this.logger = DebugLogger.getInstance();
    }
    Object.freeze(this);
  }
  
  toJSON(): AbrGeocoderDiContainerParams {
    return {
      ...this.params,
    }
  }
}
