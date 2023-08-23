import fs from 'node:fs';
import path from 'node:path';
import StreamZip, { ZipEntry } from 'node-stream-zip';
import CLIInfinityProgress  from 'cli-infinity-progress';

export interface fsIteratorResult {
  stream: NodeJS.ReadableStream;
  name: string;
}
export const fsIterator = async (
  tmpDir: string,
  targetDir: string,
  targetExtention: string,
  fileLoadingProgress?: CLIInfinityProgress,
): Promise<fsIteratorResult[]> => {
  const results: fsIteratorResult[] = [];
  for await (const d of await fs.promises.opendir(targetDir)) {
    const filePath = path.join(targetDir, d.name);
    fileLoadingProgress?.setFooter(filePath.replace(tmpDir + '/', ''));

    if (d.isDirectory()) {
      (await fsIterator(tmpDir, filePath, targetExtention, fileLoadingProgress)).forEach(result => {
        results.push(result);
      })
      continue;
    }
    if (!d.isFile()) {
      continue;
    }

    if (d.name.endsWith(targetExtention)) {
      results.push({
        stream: fs.createReadStream(filePath),
        name: d.name,
      });
      continue;
    }
    if (!d.name.endsWith('.zip')) {
      continue;
    }
    const zip = new StreamZip.async({
      file: filePath,
    });
    const entries = await zip.entries();
    for await(const zipEntry of Object.values(entries)) {
      if (zipEntry.name.endsWith('.zip')) {
        const dstDir = `${tmpDir}/${d.name.replace(/[^a-z0-9_]/gi, '')}_${zipEntry.name.replace(/[^a-z0-9_]/gi, '')}`;
        await fs.promises.mkdir(dstDir);
        const dst = `${dstDir}/${zipEntry.name}`;
        await zip.extract(zipEntry, dst);
        (await fsIterator(tmpDir, dstDir, targetExtention, fileLoadingProgress)).forEach(result => {
          results.push(result);
        })
      } else {
        results.push({
          stream: await zip.stream(zipEntry),
          name: zipEntry.name,
        })
      }
    }
  }
  return results;
}
