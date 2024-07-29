import fs from 'node:fs';
import buffCrc32 from 'buffer-crc32';

export const fromFile = async (pathToFile: string): Promise<number> => {
  if (!fs.existsSync(pathToFile)) {
    return 0;
  }
  const fileBuff = await fs.promises.readFile(pathToFile);
  return buffCrc32.unsigned(fileBuff);
};

export const fromBuffer = (data: Buffer): number => {
  return buffCrc32.unsigned(data);
};

export const fromString = (data: string): number => {
  return fromBuffer(Buffer.from(data));
};

export default {
  fromFile,
  fromBuffer,
  fromString,
}