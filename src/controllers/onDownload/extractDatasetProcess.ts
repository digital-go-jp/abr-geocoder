// reflect-metadata is necessary for DI
import 'reflect-metadata';

import { DependencyContainer } from 'tsyringe';
import {
  findTargetFilesInZipFiles, IStreamReady
} from '../../domain';

import CLIInfinityProgress from 'cli-infinity-progress';

export const extractDatasetProcess = async ({
  container,
  srcDir,
  dstDir,
}: {
  srcDir: string;
  dstDir: string;
  container: DependencyContainer;
}): Promise<IStreamReady[]> => {
  const fileLoadingProgress = container.resolve<CLIInfinityProgress | undefined>('INFINITY_PROGRESS_BAR');
  fileLoadingProgress?.setHeader('Finding dataset files...');
  fileLoadingProgress?.start();
  const csvFiles = await findTargetFilesInZipFiles({
    srcDir,
    dstDir,
    targetExtention: '.csv',
    fileLoadingProgress
  });
  fileLoadingProgress?.remove();
  return csvFiles
}