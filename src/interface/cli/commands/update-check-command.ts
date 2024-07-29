
import { EnvProvider } from '@domain/models/env-provider';
import { createSingleProgressBar } from '@domain/services/progress-bars/create-single-progress-bar';
import { resolveHome } from '@domain/services/resolve-home';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { UpdateChecker } from '@usecases/update-check/update-check-process';
import path from 'node:path';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import readline from 'node:readline/promises';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import downloadCommand from './download-command';
import { PrefLgCode } from '@domain/types/pref-lg-code';

export type UpdateCheckCommandArgv = {
  abrgDir?: string;
  d?: string;
  debug?: boolean;
  silent?: boolean;
  yes?: boolean;
  no?: boolean;
}

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
          AbrgMessage.CLI_COMMON_DATADIR_OPTION
        ),
      })
      .option('debug', {
        type: 'boolean',
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_COMMON_DEBUG_OPTION
        ),
      })
      .option('silent', {
        type: 'boolean',
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_COMMON_SILENT_OPTION
        ),
      })
      .option('yes', {
        alias: 'y',
        type: 'boolean',
        conflicts: 'no',
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_YES_FOR_DOWNLOAD_IF_UPDATE_IS_AVAILABLE
        ),
      })
      .option('no', {
        alias: 'n',
        type: 'boolean',
        conflicts: 'yes',
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_NO_FOR_DOWNLOAD_IF_UPDATE_IS_AVAILABLE
        ),
      });
  },

  handler: async (argv: ArgumentsCamelCase<UpdateCheckCommandArgv>) => {
    // silent = true のときは、プログレスバーを表示しない
    const progressBar = argv.silent ? undefined : createSingleProgressBar();
    progressBar?.start(1, 0);

    if (argv.debug) {
      console.time("update-check");
    }

    const abrgDir = resolveHome(argv.abrgDir || EnvProvider.DEFAULT_ABRG_DIR);

    // 環境設定
    const updateChecker = new UpdateChecker({
      cacheDir: path.join(abrgDir, 'download'),
      downloadDir: path.join(abrgDir, 'download'),
      database: {
        type: 'sqlite3',
        dataDir: path.join(abrgDir, 'database'),
        schemaDir: path.join(__dirname, '..', '..', '..', 'schemas', 'sqlite3'),
      }
    });
    
    // アップデートチェック
    const results = await updateChecker.updateCheck({
      progress: (current: number, total: number) => {
        progressBar?.setTotal(total);
        progressBar?.update(current);
      },
    });
    
    progressBar?.stop();
    if (argv.debug) {
      console.timeEnd("update-check");
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
      console.log(AbrgMessage.toString(AbrgMessage.UPDATE_IS_AVAILABLE));
    }
    if (argv.yes === undefined) {
      // 続けてダウンロードをするか、確認する
      const continueToDownload = await askContinueToDownload();
      if (!continueToDownload) {
        return;
      }
    }
    const lgCode: string[] = Array
      .from(new Set(results.map(x => x.lgCode)).values())
      .filter(x => x !== PrefLgCode.ALL);
    
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
    })
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
}
export default updateCheckCommand;
