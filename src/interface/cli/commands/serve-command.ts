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
import { resolveHome } from '@domain/services/resolve-home';
import { upwardFileSearch } from '@domain/services/upward-file-search';
import { AbrgError, AbrgErrorLevel } from '@domain/types/messages/abrg-error';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { AbrgApiServer } from '@interface/api-server';
import { AbrGeocoder } from '@usecases/geocode/abr-geocoder';
import { AbrGeocoderDiContainer } from '@usecases/geocode/models/abr-geocoder-di-container';
import path from 'node:path';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';

/**
 * abrg serve
 * REST apiサーバーとしてサービスを提供する
 */
export type ServeCommandArgv = {
  abrgDir?: string; // 'abrgDir' または 'd' はオプショナル
  d?: string; // alias 'd' もオプショナル
  port?: number; // HTTPサーバーのポート
};

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
          AbrgMessage.CLI_COMMON_DATADIR_OPTION,
        ),
      })
      .option('port', {
        type: 'number',
        default: 3000,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_SERVE_PORT_OPTION,
        ),
        
      })
      .coerce('port', (port: number) => {
        if (port < 1 || port > 65535 || !Number.isInteger(port)) {
          throw new Error(`port : ${port} is invalid`);
        }
        return port;
      });
  },

  handler: async (argv: ArgumentsCamelCase<ServeCommandArgv>) => {
    
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

    // ジオコーダ
    const geocoder = await AbrGeocoder.create({
      container,
      numOfThreads: 5,
    });
    
    // APIサーバー
    const server = new AbrgApiServer(geocoder);
    const port = argv.port || 3000;
    const host = '0.0.0.0';
    await server.listen(port, host);
    console.log(`server start at ${host}:${port}`);
  },
};

export default serveCommand;
