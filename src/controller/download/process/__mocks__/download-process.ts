import { DatasetMetadata } from '@domain/dataset-metadata';
import { jest } from '@jest/globals';
import { DependencyContainer } from 'tsyringe';

export const downloadProcess = jest.fn(async (params: {
  ckanId: string;
  dstDir: string;
  container: DependencyContainer;
}): Promise<{
  metadata: DatasetMetadata;
  downloadFilePath: string | null;
}> => {
  return Promise.resolve({
    downloadFilePath: `${params.dstDir}/download`,

    // curl -I https://catalog.registries.digital.go.jp/rsc/address/address_all.csv.zip
    metadata: new DatasetMetadata({
      lastModified: 'Thu, 29 Jun 2023 20:03:24 GMT',
      contentLength: 503120257,
      etag: '"85a3b4aefbe07aad6ef6da7a17d87dd4-60"',
      fileUrl: 'https://catalog.registries.digital.go.jp/rsc/address/address_all.csv.zip',
    })
  })
});