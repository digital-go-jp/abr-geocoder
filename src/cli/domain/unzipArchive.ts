import StreamZip from 'node-stream-zip';
import fs from 'node:fs';
import path from 'node:path';

export const unzipArchive = async ({
  srcZip,
  dstPath,
}: {
  srcZip: string;
  dstPath: string;
}): Promise<string> => {
  const outputPath = path.join(
    path.dirname(dstPath),
    path.basename(srcZip, '.zip')
  );
  if (fs.existsSync(outputPath)) {
    return outputPath;
  }

  const zip = new StreamZip.async({ file: srcZip });
  const entries = await zip.entries();
  const entriesAry = Object.values(entries);
  if (
    entriesAry.length === 1 &&
    entriesAry[0].name.toLowerCase().endsWith('.csv')
  ) {
    // we will use this zip file directly, so we don't need to decompress it.
    await zip.close();
    return srcZip;
  }

  const subExtracts: Promise<string>[] = [];
  zip.on('extract', (entry, filePath) => {
    if (!entry.name.toLowerCase().endsWith('.zip')) {
      return;
    }

    // If we found another zip files, decompress them
    subExtracts.push(
      unzipArchive({
        srcZip: filePath,
        dstPath,
      })
    );
  });
  await fs.promises.mkdir(outputPath, { recursive: true });
  await zip.extract(null, outputPath);
  await Promise.all(subExtracts);
  await zip.close();
  await fs.promises.rm(srcZip);

  return outputPath;
};
