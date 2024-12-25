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
import { CACHE_CREATE_PROGRESS_BAR } from '@config/progress-bar-formats';
import { EnvProvider } from '@domain/models/env-provider';
import { createSingleProgressBar } from '@domain/services/progress-bars/create-single-progress-bar';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { removeFiles } from '@domain/services/remove-files';
import { resolveHome } from '@domain/services/resolve-home';
import { upwardFileSearch } from '@domain/services/upward-file-search';
import { AbrgError, AbrgErrorLevel } from '@domain/types/messages/abrg-error';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { AbrGeocoderDiContainer } from '@usecases/geocode/models/abr-geocoder-di-container';
import { createGeocodeCaches } from '@usecases/geocode/services/create-geocode-caches';
import path from 'node:path';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';


export type InvalidCacheCommandArgv = {
  abrgDir?: string;
  d?: string;
  silent?: boolean;
};

/**
 * abrg invalid-cache
 * キャッシュを再作成する
 */
const invalidCacheCommand: CommandModule = {
  command: 'invalid-cache [options]',
  describe: AbrgMessage.toString(AbrgMessage.CLI_INVALID_CACHE_DESC),

  builder: (yargs: Argv): Argv<InvalidCacheCommandArgv> => {
    return yargs
      .option('abrgDir', {
        alias: 'd',
        type: 'string',
        default: EnvProvider.DEFAULT_ABRG_DIR,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_COMMON_DATADIR_OPTION,
        ),
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

  handler: async (argv: ArgumentsCamelCase<InvalidCacheCommandArgv>) => {
    const isSilentMode = argv.silent === true;

    if (argv.debug) {
      console.time("cache");
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

    // キャッシュの作成
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
      // バックグラウンドスレッドを用いる
      return container.env.availableParallelism();
    })();

    // silent = true のときは、プログレスバーを表示しない
    const cacheProgressBar = isSilentMode ? undefined : createSingleProgressBar(CACHE_CREATE_PROGRESS_BAR);
    cacheProgressBar?.start(1, 0);

    // キャッシュファイルを消す
    await removeFiles({
      dir: container.cacheDir,
      filename: RegExpEx.create(`.*\.abrg2`),
    });

    await createGeocodeCaches({
      container,
      maxConcurrency: numOfThreads,
      // 進捗状況を知らせるコールバック
      progress: (current: number, total: number) => {
        cacheProgressBar?.setTotal(total);
        cacheProgressBar?.update(current);
      },
    })
    cacheProgressBar?.update(cacheProgressBar.getTotal());
    cacheProgressBar?.stop();

    if (argv.debug) {
      console.timeEnd("cache");
    }
  },
};

export default invalidCacheCommand;
