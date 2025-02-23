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
import { EnvProvider } from '@domain/models/env-provider';
import { DatabaseParams } from '@domain/types/database-params';
import { DownloadDbController } from '@drivers/database/download-db-controller';
import { jest } from '@jest/globals';

// @drivers/database/__mocks__/download-db-controller
jest.mock('@drivers/database/download-db-controller');

// @domain/models/__mocks__/env-provider
jest.mock('@domain/models/env-provider');

export type DownloadDiContainerParams = {
  cacheDir: string;
  downloadDir: string;
  database: DatabaseParams;
};

const DownloadDiContainer = jest.fn((params: DownloadDiContainerParams) => {
  const toJSON = () => {
    return params;
  };
  const downloadDir = params.downloadDir;
  const database = new DownloadDbController(params.database);
  const env = new EnvProvider();
  
  return {
    env,
    database,
    downloadDir,
    getFileShowUrl: () => 'http://localhost/rc/api/3/action/package_show',
    getPackageListUrl: () => 'http://localhost/rc/api/3/action/package_list',
    toJSON,
  };
});
module.exports = {
  DownloadDiContainer,
};
