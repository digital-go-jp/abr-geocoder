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
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';


export type ServeStopCommandArgv = {
  commandPort?: number; // CLIサーバーのポート
  commandHost?: string; // CLIサーバーのホスト
};

/**
 * abrg serve stop
 * REST APIサーバーを終了する
 */
const serveStopCommand: CommandModule = {
  command: 'stop [options]',
  describe: AbrgMessage.toString(AbrgMessage.CLI_SERVE_STOP_DESC),
  builder: (yargs: Argv): Argv<ServeStopCommandArgv> => {
    return yargs
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

  handler: async (argv: ArgumentsCamelCase<ServeStopCommandArgv>) => {
    const commandHost = argv.commandHost || 'localhost';
    const commandPort = argv.commandPort || CLI_SERVER_PORT;

    const headers = new Headers();
    headers.append('Content-Type', 'text/plain');

    const response = await fetch(`http://${commandHost}:${commandPort}/command`,  {
      method: 'POST',
      headers,
      body: 'shutdown'
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    console.log(await response.text());
  },
};

export default serveStopCommand;
