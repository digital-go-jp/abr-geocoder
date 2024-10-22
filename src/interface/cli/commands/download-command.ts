/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { MAX_CONCURRENT_DOWNLOAD } from '@config/constant-values';
import { EnvProvider } from '@domain/models/env-provider';
import { getPackageInfo } from '@domain/services/package/get-package-info';
import { createSingleProgressBar } from '@domain/services/progress-bars/create-single-progress-bar';
import { resolveHome } from '@domain/services/resolve-home';
import { upwardFileSearch } from '@domain/services/upward-file-search';
import { AbrgError, AbrgErrorLevel } from '@domain/types/messages/abrg-error';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { Downloader } from '@usecases/download/download-process';
import path from 'node:path';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';


export type DownloadCommandArgv = {
  abrgDir?: string;
  d?: string;
  lgCode?: string[];
  c?: string[];
  debug?: boolean;
  silent?: boolean;
};

/**
 * abrg download
 * データセットをダウンロードする
 */
const downloadCommand: CommandModule = {
  command: 'download [options]',
  describe: AbrgMessage.toString(AbrgMessage.CLI_DOWNLOAD_DESC),

  builder: (yargs: Argv): Argv<DownloadCommandArgv> => {
    return yargs
      .option('abrgDir', {
        alias: 'd',
        type: 'string',
        default: EnvProvider.DEFAULT_ABRG_DIR,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_COMMON_DATADIR_OPTION,
        ),
      })
      .option('lgCode', {
        alias: 'c',
        type: 'array',
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_DOWNLOAD_TARGET_LGCODES,
        ),
        coerce: (lgCode: string | number) => lgCode.toString().split(','),
      })
      .option('debug', {
        type: 'boolean',
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_COMMON_DEBUG_OPTION,
        ),
      })
      .option('silent', {
        type: 'boolean',
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_COMMON_SILENT_OPTION,
        ),
      });
  },

  handler: async (argv: ArgumentsCamelCase<DownloadCommandArgv>) => {
    // silent = true のときは、プログレスバーを表示しない
    const progressBar = argv.silent ? undefined : createSingleProgressBar(' {bar} {percentage}% | {value}/{total}');
    progressBar?.start(1, 0);

    if (argv.debug) {
      console.time("download");
    }

    // プロジェクトのワークスペースディレクトリ
    const abrgDir = resolveHome(argv.abrgDir || EnvProvider.DEFAULT_ABRG_DIR);

    // ルートディレクトリを探す
    const rootDir = upwardFileSearch(__dirname, 'build');
    if (!rootDir) {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_FIND_THE_ROOT_DIR,
        level: AbrgErrorLevel.ERROR,
      });
    }

    // ダウンロードを行う
    const downloader = new Downloader({
      cacheDir: path.join(abrgDir, 'cache'),
      downloadDir: path.join(abrgDir, 'download'),
      database: {
        type: 'sqlite3',
        dataDir: path.join(abrgDir, 'database'),
      },
    });
    await downloader.download({
      // 進捗状況を知らせるコールバック
      progress: (current: number, total: number) => {
        progressBar?.setTotal(total);
        progressBar?.update(current);
      },

      // ダウンロード対象のlgcode
      lgCodes: argv.lgCode,

      // 同時ダウンロード数
      concurrentDownloads: MAX_CONCURRENT_DOWNLOAD,
    });
    
    progressBar?.stop();
    if (argv.debug) {
      console.timeEnd("download");
    }
  },
};

export default downloadCommand;
