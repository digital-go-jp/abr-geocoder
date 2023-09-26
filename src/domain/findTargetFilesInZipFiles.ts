import CLIInfinityProgress from 'cli-infinity-progress';
import StreamZip from 'node-stream-zip';
import fs from 'node:fs';
import path from 'node:path';
import StringHash from 'string-hash';
import { DatasetRow } from './dataset';

export interface IStreamReady {
  name: string;
  crc32: number;
  contentLength: number;
  lastModified: number;
  getStream(): Promise<NodeJS.ReadableStream>;
}

export class StreamReady implements IStreamReady {
  private streamFactory: () => Promise<NodeJS.ReadableStream>;
  public readonly name: string;
  public readonly crc32: number;
  public readonly contentLength: number;
  public readonly lastModified: number;

  constructor({
    zipEntry,
    streamFactory,
  }: {
    streamFactory: () => Promise<NodeJS.ReadableStream>;
    zipEntry: StreamZip.ZipEntry;
  }) {
    this.streamFactory = streamFactory;
    this.name = zipEntry.name;
    this.crc32 = zipEntry.crc;
    this.lastModified = zipEntry.time;
    this.contentLength = zipEntry.size;
    Object.freeze(this);
  }

  async getStream(): Promise<NodeJS.ReadableStream> {
    return await this.streamFactory();
  }
}

export const findTargetFilesInZipFiles = async ({
  srcDir,
  dstDir,
  targetExtention,
  fileLoadingProgress,
  datasetHistory,
}: {
  srcDir: string;
  dstDir: string;
  targetExtention: string;
  fileLoadingProgress?: CLIInfinityProgress;
  datasetHistory: Map<string, DatasetRow>;
}): Promise<IStreamReady[]> => {
  const results: IStreamReady[] = [];
  for await (const d of await fs.promises.opendir(srcDir)) {
    const filePath = path.join(srcDir, d.name);
    fileLoadingProgress?.setFooter(filePath.replace(dstDir + '/', ''));

    if (d.isDirectory()) {
      (
        await findTargetFilesInZipFiles({
          srcDir: filePath,
          dstDir,
          targetExtention,
          fileLoadingProgress,
          datasetHistory,
        })
      ).forEach(result => {
        results.push(result);
      });
      continue;
    }
    if (!d.isFile() || !d.name.endsWith('.zip')) {
      continue;
    }
    const zip = new StreamZip.async({
      file: filePath,
    });
    const entries = await zip.entries();
    for await (const zipEntry of Object.values(entries)) {
      if (zipEntry.name.endsWith(targetExtention)) {
        const prev = datasetHistory.get(zipEntry.name);
        const isSameFile = prev?.equalExceptType({
          key: zipEntry.name,
          contentLength: zipEntry.size,
          crc32: zipEntry.crc,
          lastModified: zipEntry.time,
        });
        if (isSameFile) {
          continue;
        }

        results.push(
          new StreamReady({
            zipEntry,
            streamFactory: async () => {
              return zip.stream(zipEntry);
            },
          })
        );
        continue;
      }
      if (!zipEntry.name.endsWith('.zip')) {
        continue;
      }

      const tmpDirName = StringHash(
        `${d.name.replace(/[^a-z0-9_]/gi, '')}_${zipEntry.name.replace(
          /[^a-z0-9_]/gi,
          ''
        )}`
      );
      const dstDirPath = `${dstDir}/${tmpDirName}`;
      await fs.promises.mkdir(dstDirPath);
      const dst = `${dstDirPath}/${zipEntry.name}`;
      await zip.extract(zipEntry, dst);
      (
        await findTargetFilesInZipFiles({
          srcDir: dstDirPath,
          dstDir: dstDir,
          targetExtention,
          fileLoadingProgress,
          datasetHistory,
        })
      ).forEach(result => {
        results.push(result);
      });
    }
  }

  return results;
};
