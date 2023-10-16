import fs from 'node:fs';
import path from 'node:path';

export async function upwardFileSearch(
  currDir: string,
  targetFilename: string
): Promise<string | undefined> {
  try {
    const files = await fs.promises.readdir(currDir);
    const existFile = files.some(file => file.endsWith(targetFilename));

    // 見つかった場合は探索終了
    if (existFile) {
      return path.resolve(currDir, targetFilename);
    }

    // 見つからない場合は1つ上の階層を探索
    return upwardFileSearch(path.resolve(currDir, '..'), targetFilename);
  } catch (err) {
    // root directoryに達した時点でエラーになるはずなので、探索を辞める
    return undefined;
  }
}
