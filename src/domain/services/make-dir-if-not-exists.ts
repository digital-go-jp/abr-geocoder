import fs from 'node:fs';

// Creates a directory recursively
// if the specified directory path is not existed.
export const makeDirIfNotExists = (dirPath: string) => {
  if (fs.existsSync(dirPath)) {
    return;
  }

  fs.mkdirSync(dirPath, {
    recursive: true,
  });
}