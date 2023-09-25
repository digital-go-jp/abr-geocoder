import CLIInfinityProgress from 'cli-infinity-progress';
import StreamZip from 'node-stream-zip';
import fs from 'node:fs';
import path from 'node:path';
import StringHash from 'string-hash';

export interface IStreamReady {
  name: string;
  getStream(): Promise<NodeJS.ReadableStream>;
}

export class StreamReady implements IStreamReady {
  private streamFactory: () => Promise<NodeJS.ReadableStream>;
  public readonly name: string;

  constructor({
    name,
    streamFactory,
  }: {
    streamFactory: () => Promise<NodeJS.ReadableStream>,
    name: string;
  }) {
    this.streamFactory = streamFactory;
    this.name = name;
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
}: {
  srcDir: string;  
  dstDir: string;
  targetExtention: string;
  fileLoadingProgress?: CLIInfinityProgress
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
          fileLoadingProgress
        })
      ).forEach(result => {
        results.push(result);
      });
      continue;
    }
    if (!d.isFile()) {
      continue;
    }

    if (d.name.endsWith(targetExtention)) {
      results.push(new StreamReady({
        streamFactory: async () => {
          return fs.createReadStream(filePath);
        },
        name: d.name,
      }));
      continue;
    }
    if (!d.name.endsWith('.zip')) {
      continue;
    }
    const zip = new StreamZip.async({
      file: filePath,
    });
    const entries = await zip.entries();
    for await (const zipEntry of Object.values(entries)) {
      if (zipEntry.name.endsWith('.zip')) {
        const tmpDirName = StringHash(`${d.name.replace(/[^a-z0-9_]/gi, '')}_${zipEntry.name.replace(/[^a-z0-9_]/gi, '')}`);
        const dstDirPath = `${dstDir}/${tmpDirName}`;
        await fs.promises.mkdir(dstDirPath);
        const dst = `${dstDirPath}/${zipEntry.name}`;
        await zip.extract(zipEntry, dst);
        (
          await findTargetFilesInZipFiles({
            srcDir: dstDirPath,
            dstDir: dstDir, 
            targetExtention,
            fileLoadingProgress
          })
        ).forEach(result => {
          results.push(result);
        });
      } else {
        results.push(new StreamReady({
          name: zipEntry.name,
          streamFactory: async () => {
            return zip.stream(zipEntry);
          },
        }));
      }
    }
  }

  return results;
};