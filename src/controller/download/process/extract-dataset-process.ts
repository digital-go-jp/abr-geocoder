// reflect-metadata is necessary for DI
import 'reflect-metadata';

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
  fileLoadingProgress?.setHeader('Finding dataset files...');
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
