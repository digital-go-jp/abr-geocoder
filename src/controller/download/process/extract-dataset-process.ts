/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
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

import { AbrgMessage } from '@domain/abrg-message/abrg-message';
import { DatasetRow } from '@domain/dataset/dataset-row';
import { findTargetFilesInZipFiles } from '@domain/find-target-files-in-zip-files';
import { IStreamReady } from '@domain/istream-ready';
import { DI_TOKEN } from '@interface-adapter/tokens';
import CLIInfinityProgress from 'cli-infinity-progress';
import path from 'node:path';
import { DependencyContainer } from 'tsyringe';

export const extractDatasetProcess = async ({
  container,
  srcFile,
  dstDir,
  datasetHistory,
}: {
  srcFile: string;
  dstDir: string;
  container: DependencyContainer;
  datasetHistory: Map<string, DatasetRow>;
}): Promise<IStreamReady[]> => {
  const fileLoadingProgress = container.resolve<
    CLIInfinityProgress | undefined
  >(DI_TOKEN.INFINITY_PROGRESS_BAR);
  fileLoadingProgress?.setHeader(
    AbrgMessage.toString(AbrgMessage.FINDING_THE_DATASET_FILES)
  );
  fileLoadingProgress?.start();
  const csvFiles = await findTargetFilesInZipFiles({
    srcDir: path.dirname(srcFile),
    dstDir,
    targetExtention: '.csv',
    fileLoadingProgress,
    datasetHistory,
  });
  fileLoadingProgress?.remove();
  return csvFiles;
};
