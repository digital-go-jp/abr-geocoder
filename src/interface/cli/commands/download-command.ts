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
import { CACHE_CREATE_PROGRESS_BAR, DOWNLOAD_PROGRESS_BAR } from '@config/progress-bar-formats';
import { EnvProvider } from '@domain/models/env-provider';
import { createSingleProgressBar } from '@domain/services/progress-bars/create-single-progress-bar';
import { resolveHome } from '@domain/services/resolve-home';
import { upwardFileSearch } from '@domain/services/upward-file-search';
import { AbrgError, AbrgErrorLevel } from '@domain/types/messages/abrg-error';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { Downloader } from '@usecases/download/download-process';
import { AbrGeocoderDiContainer } from '@usecases/geocode/models/abr-geocoder-di-container';
import { createGeocodeCaches } from '@usecases/geocode/services/create-geocode-caches';
import path from 'node:path';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';


export type DownloadCommandArgv = {
  abrgDir?: string;
  d?: string;
  lgCode?: string[];
  c?: string[];
  debug?: boolean;
  silent?: boolean;
  threads?: number;
  keep?: boolean;
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
      .option('threads', {
        alias: 't',
        type: 'number',
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_DOWNLOAD_THREADS,
        ),
      })
      .option('keep', {
        type: 'boolean',
        default: false,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_DOWNLOAD_KEEP_OPTION,
        ),
      })
      .option('debug', {
        type: 'boolean',
        default: false,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_COMMON_DEBUG_OPTION,
        ),
      })
      .option('silent', {
        type: 'boolean',
        default: false,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_COMMON_SILENT_OPTION,
        ),
      });
  },

  handler: async (argv: ArgumentsCamelCase<DownloadCommandArgv>) => {
    const isSilentMode = argv.silent === true;

    // jestで実行時 or silent = true のときは、プログレスバーを表示しない
    const downloadProgressBar = process.env.JEST_WORKER_ID || isSilentMode ? undefined : createSingleProgressBar(DOWNLOAD_PROGRESS_BAR);
    downloadProgressBar?.start(1, 0);

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

    // DIコンテナの作成
    const container = new AbrGeocoderDiContainer({
      cacheDir: path.join(abrgDir, 'cache'),
      database: {
        type: 'sqlite3',
        dataDir: path.join(abrgDir, 'database'),
      },
      debug: false,
    });

    // スレッド数を決める
    const numOfThreads = (() => {
      if (process.env.JEST_WORKER_ID) {
        // メインスレッドで処理を行う
        return 1;
      }
    
      if (argv.threads && Number.isInteger(argv.threads)) {
        // スレッド数の指定がある場合は従う
        return Math.max(Math.floor(argv.threads), 1);
      }

      // バックグラウンドスレッドを用いる
      return container.env.availableParallelism();
    })();

    // ダウンロードを行う
    const downloader = new Downloader({
      cacheDir: path.join(abrgDir, 'cache'),
      downloadDir: path.join(abrgDir, 'download'),
      database: {
        type: 'sqlite3',
        dataDir: path.join(abrgDir, 'database'),
      },
      keepFiles: argv.keep,
    });
    await downloader.download({
      // 進捗状況を知らせるコールバック
      progress: (current: number, total: number) => {
        downloadProgressBar?.setTotal(total);
        downloadProgressBar?.update(current);
      },

      // ダウンロード対象のlgcode
      lgCodes: argv.lgCode,

      // 同時ダウンロード数
      concurrentDownloads: MAX_CONCURRENT_DOWNLOAD,

      // 使用するスレッド数
      numOfThreads,
    });
    downloadProgressBar?.stop();

    // jestで実行時 or silent = true のときは、プログレスバーを表示しない
    const cacheProgressBar = process.env.JEST_WORKER_ID || isSilentMode ? undefined : createSingleProgressBar(CACHE_CREATE_PROGRESS_BAR);
    cacheProgressBar?.start(1, 0);

    // 処理が遅延してプログレスバーが変化しなくなると止まってしまったように思えてしまうので、
    // タイマーで定期的にETAを更新する
    const progressTimer = cacheProgressBar && setInterval(() => {
      cacheProgressBar?.updateETA();
    }, 1000);

    await createGeocodeCaches({
      container,
      maxConcurrency: numOfThreads,
      // 進捗状況を知らせるコールバック
      progress: (current: number, total: number) => {
        cacheProgressBar?.setTotal(total);
        cacheProgressBar?.update(current);
      },
    });
    cacheProgressBar?.stop();
    if (progressTimer) {
      clearInterval(progressTimer);
    }

    if (argv.debug) {
      console.timeEnd("download");
    }
  },
};

export default downloadCommand;
