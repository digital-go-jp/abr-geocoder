import path from 'node:path';
import os from 'node:os';

export const resolveHome = (filepath: string): string => {
  if (!filepath || filepath[0] !== '~') {
    return filepath;
  }
  return path.join(os.homedir(), filepath.slice(1));
}