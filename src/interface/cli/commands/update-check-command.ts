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
import { EnvProvider } from '@domain/models/env-provider';
import { createSingleProgressBar } from '@domain/services/progress-bars/create-single-progress-bar';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { resolveHome } from '@domain/services/resolve-home';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { PrefLgCode } from '@domain/types/pref-lg-code';
import { UpdateChecker } from '@usecases/update-check/update-check-process';
import path from 'node:path';
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import downloadCommand from './download-command';

export type UpdateCheckCommandArgv = {
  abrgDir?: string;
  d?: string;
  debug?: boolean;
  silent?: boolean;
  yes?: boolean;
  no?: boolean;
};

/**
 * abrg update-check
 * キャッシュファイル&ローカルDBと比較して、新しいデータセットの有無を調べる
 */
const updateCheckCommand: CommandModule = {
  command: 'update-check [options]',
  describe: AbrgMessage.toString(AbrgMessage.CLI_UPDATE_CHECK_DESC),

  builder: (yargs: Argv): Argv<UpdateCheckCommandArgv> => {
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
      })
      .option('yes', {
        alias: 'y',
        type: 'boolean',
        conflicts: 'no',
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_YES_FOR_DOWNLOAD_IF_UPDATE_IS_AVAILABLE,
        ),
      })
      .option('no', {
        alias: 'n',
        type: 'boolean',
        conflicts: 'yes',
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_NO_FOR_DOWNLOAD_IF_UPDATE_IS_AVAILABLE,
        ),
      });
  },

  handler: async (argv: ArgumentsCamelCase<UpdateCheckCommandArgv>) => {
    // silent = true のときは、プログレスバーを表示しない
    const progressBar = argv.silent ? undefined : createSingleProgressBar(' {bar} {percentage}% | {value}/{total}');
    progressBar?.start(1, 0);

    if (argv.debug) {
      console.time("update-check");
    }

    const abrgDir = resolveHome(argv.abrgDir || EnvProvider.DEFAULT_ABRG_DIR);

    // 環境設定
    const updateChecker = new UpdateChecker({
      cacheDir: path.join(abrgDir, 'cache'),
      downloadDir: path.join(abrgDir, 'download'),
      database: {
        type: 'sqlite3',
        dataDir: path.join(abrgDir, 'database'),
      },
    });
    
    // アップデートチェック
    const results = await updateChecker.updateCheck({
      progress: (current: number, total: number) => {
        progressBar?.update(current);
        progressBar?.setTotal(total);
      },
    });
    
    progressBar?.stop();
    if (argv.debug) {
      console.timeEnd("update-check");
    }
    if (!results) {
      // データベースが開けない
      if (!argv.silent) {
        console.error(AbrgMessage.toString(AbrgMessage.CANNOT_OPEN_THE_DATABASE));
      }
      return;
    }
    
    // アップデートがない
    if (results.length === 0) {
      if (!argv.silent) {
        console.log(AbrgMessage.toString(AbrgMessage.NO_UPDATE_IS_AVAILABLE));
      }
      return;
    }

    // ダウンロードしないことが指定されている場合、終了
    if (argv.no === true) {
      return;
    }
    if (!argv.silent) {
      console.log(AbrgMessage.toString(AbrgMessage.UPDATE_IS_AVAILABLE, {
        num_of_update: results.length,
      }));
    }
    if (argv.yes === undefined) {
      // 指定がなければ終了
      if (argv.silent) {
        return;
      }
      // 続けてダウンロードをするか、確認する
      const continueToDownload = await askContinueToDownload();
      if (!continueToDownload) {
        return;
      }
    }
    const lgCode: string[] = Array
      .from(new Set(results.map(x => x.lgCode)).values())
      .filter(x => x !== PrefLgCode.ALL as string);
    
    // ダウンロード処理を行う
    await downloadCommand.handler({
      abrgDir: argv.abrgDir,
      d: argv.d,
      lgCode,
      c: lgCode,
      debug: argv.debug,
      silent: argv.silent,
      _: argv._,
      $0: argv.$0,
    });
  },
};
const askContinueToDownload = async (): Promise<boolean> => {
  const ask = readline.createInterface({ 
    input: process.stdin,
    output: process.stdout,
  });
  let answer: boolean | undefined = undefined;
  while (answer === undefined) {
    const received = await ask.question(`${AbrgMessage.toString(AbrgMessage.PROMPT_CONTINUE_TO_DOWNLOAD)} [Y/N] `);
    if (RegExpEx.create('^[YN]')) {
      answer = received[0].toUpperCase() === 'Y';
      break;
    }
  }
  ask.close();
  return answer;
};
export default updateCheckCommand;
