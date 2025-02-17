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
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { Argv, CommandModule } from 'yargs';
import serveStartCommand from './serve/serve-start-command';
import serveStopCommand from './serve/serve-stop-command';

/**
 * abrg serve
 * REST apiサーバーとしてサービスを提供する
 */
export type ServeCommandArgv = {
};

const serveCommand: CommandModule = {
  command: 'serve <command>',
  describe: AbrgMessage.toString(AbrgMessage.CLI_SERVE_DESC),

  builder: (yargs: Argv): Argv<ServeCommandArgv> => {
    return yargs
      .command(serveStartCommand)
      .command(serveStopCommand)
      .fail(() => {
        yargs.showHelp();
      });
  },
  handler: () => {},
};

export default serveCommand;
