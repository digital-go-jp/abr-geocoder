import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export async function getDataDir(overrideDataDir?: string) {
  let dataDir: string;
  if (overrideDataDir) {
    dataDir = overrideDataDir;
  } else {
    dataDir = path.join(os.homedir(), '.abr-geocoder');
  }
  await fs.promises.mkdir(dataDir, {recursive: true});
  return dataDir;
}
