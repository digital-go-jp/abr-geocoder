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
import { makeDirIfNotExists } from '@domain/services/make-dir-if-not-exists';
import { DatabaseParams } from '@domain/types/database-params';
import { UpdateCheckDbController } from '@drivers/database/update-check-db-controller';

export type UpdateCheckDiContainerParams = {
  cacheDir: string;
  downloadDir: string;
  database: DatabaseParams;
};

export class UpdateCheckDiContainer extends CommonDiContainer {

  public readonly downloadDir: string;
  public readonly database: UpdateCheckDbController;

  constructor(private params: UpdateCheckDiContainerParams) {
    super();

    this.downloadDir = params.downloadDir;
    makeDirIfNotExists(params.downloadDir);

    // ダウンロードディレクトリにキャッシュファイルを保存する
    makeDirIfNotExists(params.cacheDir);

    this.database = new UpdateCheckDbController(params.database);

    Object.freeze(this);
  }

  getFileShowUrl(): URL {
    return new URL(`https://${this.env.hostname}/rc/api/3/action/package_show`);
  }
  getPackageListUrl(): URL {
    return new URL(`https://${this.env.hostname}/rc/api/3/action/package_list`);
  }

  toJSON(): UpdateCheckDiContainerParams {
    return {
      ...this.params,
      downloadDir: this.downloadDir,
      cacheDir: this.params.cacheDir,
    };
  }
}
