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
import { CLI_SERVER_PORT } from '@config/constant-values';
import { EnvProvider } from '@domain/models/env-provider';
import { resolveHome } from '@domain/services/resolve-home';
import { upwardFileSearch } from '@domain/services/upward-file-search';
import { AbrgError, AbrgErrorLevel } from '@domain/types/messages/abrg-error';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { AbrgApiServer } from '@interface/abrg-api-server';
import { CliServer } from '@interface/cli-server';
import { AbrGeocoder } from '@usecases/geocode/abr-geocoder';
import { AbrGeocoderDiContainer } from '@usecases/geocode/models/abr-geocoder-di-container';
import path from 'node:path';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';


export type ServeStartCommandArgv = {
  abrgDir?: string; // 'abrgDir' または 'd' はオプショナル
  d?: string; // alias 'd' もオプショナル
  port?: number; // HTTPサーバーのポート
  commandPort?: number; // CLIサーバーのポート
  commandHost?: string; // CLIサーバーのホスト
};

/**
 * abrg serve start
 * REST APIサーバーとしてサービスを提供する
 */
const serveStartCommand: CommandModule = {
  command: 'start [options]',
  describe: AbrgMessage.toString(AbrgMessage.CLI_SERVE_START_DESC),
  builder: (yargs: Argv): Argv<ServeStartCommandArgv> => {
    return yargs
      .option('abrgDir', {
        alias: 'd',
        type: 'string',
        default: EnvProvider.DEFAULT_ABRG_DIR,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_COMMON_DATADIR_OPTION,
        ),
      })
      .option('port', {
        alias: 'p',
        type: 'number',
        default: 3000,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_SERVE_API_PORT_OPTION,
        ),
      })
      .coerce('port', (port: number) => {
        if (port < 1 || port > 65535 || !Number.isInteger(port)) {
          throw new Error(`port : ${port} is invalid`);
        }
        return port;
      })
      .option('commandHost', {
        alias: 'ch',
        type: 'string',
        default: 'localhost',
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_SERVE_CONTROL_HOST_OPTION,
        ),
      })
      .option('commandPort', {
        alias: 'cp',
        type: 'number',
        default: CLI_SERVER_PORT,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_SERVE_CONTROL_PORT_OPTION,
        ),
      })
      .coerce('commandPort', (port: number) => {
        if (port < 1 || port > 65535 || !Number.isInteger(port)) {
          throw new Error(`commandPort : ${port} is invalid`);
        }
        return port;
      });
  },

  handler: async (argv: ArgumentsCamelCase<ServeStartCommandArgv>) => {
    
        const abrgDir = resolveHome(argv.abrgDir || EnvProvider.DEFAULT_ABRG_DIR);
    
        // ThreadGeocodeTransformで 各スレッドがstdout を使用しようとして、
        // イベントリスナーを取り合いになるため、以下の警告が発生する模様。
        // 動作的には問題ないので、 process.stdout.setMaxListeners(0) として警告を殺す。
        //
        // (node:62246) MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
        // 11 unpipe listeners added to [WriteStream]. Use emitter.setMaxListeners() to increase limit
        process.stdout.setMaxListeners(0);
    
        const rootDir = upwardFileSearch(__dirname, 'build');
        if (!rootDir) {
          throw new AbrgError({
            messageId: AbrgMessage.CANNOT_FIND_THE_ROOT_DIR,
            level: AbrgErrorLevel.ERROR,
          });
        }
        
        // ジオコーダ作成のためのパラメータ
        const container = new AbrGeocoderDiContainer({
          database: {
            type: 'sqlite3',
            dataDir: path.join(abrgDir, 'database'),
          },
          cacheDir: path.join(abrgDir, 'cache'),
          debug: EnvProvider.isDebug,
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
    
        // ジオコーダ
        const geocoder = await AbrGeocoder.create({
          container,
          numOfThreads,
          isSilentMode: false,
        });
        
        // APIサーバー
        const apiServer = new AbrgApiServer(geocoder);
        const apiPort = argv.port || 3000;
        const apiHost = '0.0.0.0';
        await apiServer.listen(apiPort, apiHost);
        console.log(`api server: at ${apiHost}:${apiPort}`);
    
        // コマンドサーバー
        // API用のポートは公開し、コマンド制御を行うためのポートは原則公開しないことで、セキュリティを担保する。
        // 将来的には管理画面用のコマンドなどを実装する
        const commandServer = new CliServer(apiServer);
        const commandPort = argv.commandPort || CLI_SERVER_PORT;
        const commandHost = argv.commandHost || '0.0.0.0';
        await commandServer.listen(commandPort, commandHost);
        console.log(`command server: at ${commandHost}:${commandPort}`);
  },
};

export default serveStartCommand;
