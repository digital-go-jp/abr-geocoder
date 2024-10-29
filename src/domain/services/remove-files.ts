import path from 'node:path';
import fs from 'node:fs';
import { RegExpEx } from "@domain/services/reg-exp-ex";

export const removeFiles = async (params: Required<{
    dir: string;
    filename: string | RegExp;
}>) => {
    const filePattern: RegExp = (() => {
        if (typeof params.filename === 'string') {
            return RegExpEx.create(`^${params.filename}$`);
        } else {
            return params.filename;
        }
    })();

    // 古いキャッシュファイルを削除
    const dir = await fs.promises.opendir(params.dir);
    const removedFiles: string[] = [];
    for await (const dirent  of dir) {
        if (!filePattern.test(dirent.name)) {
            continue;
        }
        removedFiles.push(dirent.name);
        try {
            await fs.promises.unlink(path.join(dirent.parentPath, dirent.name));
        } catch (e: unknown) {
            // Do nothing here
        }
    }
    return removedFiles;
};
