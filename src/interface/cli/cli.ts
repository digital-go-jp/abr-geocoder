#!/usr/bin/env node

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
import { getPackageInfo } from '@domain/services/package/get-package-info';
import yargs, { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import downloadCommand from './commands/download-command';
import geocodeCommand from './commands/geocode-command';
import serveCommand from './commands/serve-command';
import updateCheckCommand from './commands/update-check-command';
import { parseHelper } from './services/parse-helper';
import { EnvProvider } from '@domain/models/env-provider';
import testCommand from './commands/test-command';

// const terminalWidth = Math.min(yargs.terminalWidth(), 120);
const terminalWidth = 120;

export const main = async (
  ...processArgv: string[]
) => {
  const { version } = getPackageInfo();
  const parsedArgs = parseHelper(processArgv);

  /**
   * CLIパーサー (通常のプログラムのエントリーポイント)
   */
  return yargs(hideBin(parsedArgs))
    .version(version)
    .wrap(terminalWidth)
    .scriptName('abrg')
    .command(updateCheckCommand)
    .command(downloadCommand)
    .command(geocodeCommand)
    .command(serveCommand)
    .fail((msg: string, e: Error, yargs: Argv<{}>): void => {
      if (parsedArgs.length <= 2) {
        // Show help if no options are provided.
        yargs.showVersion((version: string) => {
          console.error('====================================');
          console.error(`= abr-geocoder version: ${version}`);
          console.error('====================================');
        });
        yargs.showHelp();
        return;
      }
    
      // Otherwise, show the error message
      console.error(`[error] ${msg || e.message}`, e);
    
      if (!EnvProvider.isDebug) {
        process.exit(1);
      }
    })
    .parse();
};
main(...process.argv);
