// reflect-metadata is necessary for DI
import 'reflect-metadata';

import { DependencyContainer } from 'tsyringe';

import CLIInfinityProgress from 'cli-infinity-progress';
import {
  DatasetRow,
  IStreamReady,
  findTargetFilesInZipFiles,
} from '../../domain';
import path from 'node:path';

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
  >('INFINITY_PROGRESS_BAR');
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
