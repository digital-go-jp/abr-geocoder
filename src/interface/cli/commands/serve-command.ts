
import { EnvProvider } from '@domain/models/env-provider';
import { resolveHome } from '@domain/services/resolve-home';
import { upwardFileSearch } from '@domain/services/upward-file-search';
import { AbrgError, AbrgErrorLevel } from '@domain/types/messages/abrg-error';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { SearchTarget } from '@domain/types/search-target';
import { AbrgApiServer } from '@interface/api-server';
import path from 'node:path';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';

/**
 * abrg serve
 * REST apiサーバーとしてサービスを提供する
 */
export type ServeCommandArgv = {
  abrgDir?: string; // 'abrgDir' または 'd' はオプショナル
  d?: string; // alias 'd' もオプショナル

  target?: SearchTarget; // 'target' はオプショナル

  fuzzy?: string; // 'fuzzy' はオプショナル

  port?: number; // HTTPサーバーのポート
}

const serveCommand: CommandModule = {
  command: 'serve [options]',
  describe: AbrgMessage.toString(AbrgMessage.CLI_SERVE_DESC),

  builder: (yargs: Argv): Argv<ServeCommandArgv> => {
    return yargs
      .option('abrgDir', {
        alias: 'd',
        type: 'string',
        default: EnvProvider.DEFAULT_ABRG_DIR,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_COMMON_DATADIR_OPTION
        ),
      })
      .option('target', {
        type: 'string',
        default: SearchTarget.ALL,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_GEOCODE_TARGET_OPTION
        ),
        choices: [SearchTarget.ALL, SearchTarget.RESIDENTIAL, SearchTarget.PARCEL],
      })
      .option('fuzzy', {
        type: 'string',
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_GEOCODE_FUZZY_OPTION
        ),
        coerce: fuzzy => {
          if (fuzzy.length !== 1) {
            console.error(
              AbrgMessage.toString(AbrgMessage.CLI_GEOCODE_FUZZY_CHAR_ERROR)
            );
            process.exit(1);
          }
          return fuzzy;
        },
      })
      .option('port', {
        type: 'number',
        default: 3000,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_SERVE_PORT_OPTION
        ),
        
      })
      .coerce('port', (port: number) => {
        if (port < 1 || port > 65535 || !Number.isInteger(port)) {
          throw new Error(`port : ${port} is invalid`)
        }
        return port;
      });
  },

  handler: async (argv: ArgumentsCamelCase<ServeCommandArgv>) => {
    
    const abrgDir = resolveHome(argv.abrgDir || EnvProvider.DEFAULT_ABRG_DIR);

    const debug = argv.debug === true;

    // ThreadGeocodeTransformで　各スレッドがstdout を使用しようとして、
    // イベントリスナーを取り合いになるため、以下の警告が発生する模様。
    // 動作的には問題ないので、 process.stdout.setMaxListeners(0) として警告を殺す。
    //
    // (node:62246) MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
    // 11 unpipe listeners added to [WriteStream]. Use emitter.setMaxListeners() to increase limit
    process.stdout.setMaxListeners(0);

    const rootDir = await upwardFileSearch(__dirname, 'build');
    if (!rootDir) {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_FIND_THE_ROOT_DIR,
        level: AbrgErrorLevel.ERROR,
      });
    }

    const server = new AbrgApiServer({
      database: {
        type: 'sqlite3',
        dataDir: path.join(EnvProvider.DEFAULT_ABRG_DIR, 'database'),
        schemaDir: path.join(rootDir, 'schemas', 'sqlite3'),
      },
      searchTarget: SearchTarget.ALL,
      fuzzy: '?',
    });

    const port = argv.port || 3000;
    const host = '0.0.0.0';

    await server.listen(port, host);
    console.log(`server start at ${host}:${port}`)
  }
};

export default serveCommand;
