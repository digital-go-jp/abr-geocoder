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
import { DownloadDbController } from '@drivers/database/download-db-controller';

export type DownloadDiContainerParams = {
  cacheDir: string;
  downloadDir: string;
  database: DatabaseParams;

  keepFiles?: boolean;
};

export class DownloadDiContainer extends CommonDiContainer {

  public readonly downloadDir: string;
  public readonly database: DownloadDbController;

  constructor(private params: DownloadDiContainerParams) {
    super();

    this.downloadDir = params.downloadDir;
    makeDirIfNotExists(params.downloadDir);

    // ダウンロードディレクトリにキャッシュファイルを保存する
    makeDirIfNotExists(params.cacheDir);
    this.database = new DownloadDbController(params.database);

    Object.freeze(this);
  }

  // ダウンロードしたデータセットファイルを削除しないで残すかどうか
  get keepFiles(): boolean {
    return this.params.keepFiles || false;
  }

  // データセットファイル個別の情報を取得するためのエントリーポイント
  getFileShowUrl() {
    return new URL(`https://${this.env.hostname}/rc/api/3/action/package_show`);
  }

  // データセットの一覧を取得するためのエントリーポイント
  getPackageListUrl() {
    return new URL(`https://${this.env.hostname}/rc/api/3/action/package_list`);
  }

  // JSON形式に変換する
  toJSON(): DownloadDiContainerParams {
    return this.params;
  }
}
