#!/usr/bin/env node

// reflect-metadata is necessary for DI
import 'reflect-metadata';

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import yargs, { ArgumentsCamelCase, MiddlewareFunction } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { onDownload, onUpdateCheck, onGeocoding } from './controllers';
import {
  AbrgError,
  AbrgErrorLevel,
  AbrgMessage,
  OutputFormat,
  bubblingFindFile,
} from './domain';
import { parsePackageJson, setupContainer } from './interface-adapter';
import { DEFAULT_FUZZY_CHAR } from './settings/constantValues';

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.abr-geocoder');
const terminalWidth = Math.min(yargs.terminalWidth(), 120);

export const main = async (...processArgv: string[]) => {

  const { version } = await (async () => {
    
    if (process.env.NODE_ENV === 'test') {
      return {
        version: '0.0.0-test',
        description: 'test',
      };
    }
    const packageJsonFilePath = await bubblingFindFile(__dirname, 'package.json');
    if (!packageJsonFilePath) {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_FIND_PACKAGE_JSON_FILE,
        level: AbrgErrorLevel.ERROR,
      });
    }

    return parsePackageJson({
      filePath: packageJsonFilePath,
    });
  })();


  /**
   * CLIパーサー (通常のプログラムのエントリーポイント)
   */
  yargs
    .version(version)
    .wrap(terminalWidth)
    .scriptName('abrg')

    /**
     * abrg update-check
     * ローカルDBと比較して新しいデータセットの有無を調べる
     */
    .command(
      'update-check [options]',
      AbrgMessage.toString(AbrgMessage.CLI_UPDATE_CHECK_DESC),
      (yargs: yargs.Argv) => {
        return yargs
          .option('dataDir', {
            alias: 'd',
            type: 'string',
            default: DEFAULT_DATA_DIR,
            describe: AbrgMessage.toString(
              AbrgMessage.CLI_COMMON_DATADIR_OPTION
            ),
          })
          .option('resource', {
            alias: 'r',
            type: 'string',
            default: 'ba000001',
            describe: AbrgMessage.toString(
              AbrgMessage.CLI_COMMON_RESOURCE_OPTION
            ),
          });
      },
      async argv => {
        const ckanId = argv.resource;
        const container = await setupContainer({
          dataDir: argv.dataDir,
          ckanId,
        });
        await onUpdateCheck({
          container,
          ckanId,
        });
      }
    )

    /**
     * abrg download
     * データセットをダウンロードする
     */
    .command(
      'download [options]',
      AbrgMessage.toString(AbrgMessage.CLI_DOWNLOAD_DESC),
      (yargs: yargs.Argv) => {
        return yargs
          .option('dataDir', {
            alias: 'd',
            type: 'string',
            default: DEFAULT_DATA_DIR,
            describe: AbrgMessage.toString(
              AbrgMessage.CLI_COMMON_DATADIR_OPTION
            ),
          })
          .option('resource', {
            alias: 'r',
            type: 'string',
            default: 'ba000001',
            describe: AbrgMessage.toString(
              AbrgMessage.CLI_COMMON_RESOURCE_OPTION
            ),
          });
      },
      async argv => {
        const ckanId = argv.resource;
        const container = await setupContainer({
          dataDir: argv.dataDir,
          ckanId,
        });
        await onDownload({
          container,
          ckanId,
          dataDir: argv.dataDir,
        });
      }
    )
    .command(
      'hidden',
      '',
      (yargs: yargs.Argv) => {
        console.log('here!');
        yargs.option('file', {
          type: 'string',
          nargs: 1,
        })
      },
      async (args: yargs.ArgumentsCamelCase) => {
        console.log(args);
      }
    )

    /**
     * abrg
     * 入力されたファイル、または標準入力から与えられる住所をジオコーディングする
     */
    .command(
      '$0 <inputFile> [outputFile] [options]',
      AbrgMessage.toString(AbrgMessage.CLI_GEOCODE_DESC),
      (yargs: yargs.Argv) => {
        return yargs
          .option('fuzzy', {
            type: 'string',
            default: DEFAULT_FUZZY_CHAR,
            describe: AbrgMessage.toString(
              AbrgMessage.CLI_GEOCODE_FUZZY_OPTION
            ),
          })
          .option('dataDir', {
            alias: 'd',
            type: 'string',
            default: DEFAULT_DATA_DIR,
            describe: AbrgMessage.toString(
              AbrgMessage.CLI_COMMON_DATADIR_OPTION
            ),
          })
          .option('resource', {
            alias: 'r',
            type: 'string',
            default: 'ba000001',
            describe: AbrgMessage.toString(
              AbrgMessage.CLI_COMMON_RESOURCE_OPTION
            ),
          })
          .option('format', {
            alias: 'f',
            type: 'string',
            default: 'csv',
            describe: AbrgMessage.toString(
              AbrgMessage.CLI_GEOCODE_FORMAT_OPTION
            ),
            choices: ['csv', 'json', 'ndjson', 'geojson', 'ndgeojson'],
          })
          .positional('inputFile', {
            describe: AbrgMessage.toString(AbrgMessage.CLI_GEOCODE_INPUT_FILE),
            type: 'string',
            coerce: (inputFile: string) => {
              console.log(`--->inputFile: ${inputFile}`, processArgv);
              if (process.env.NODE_ENV === 'test' && inputFile !== 'invalidFilePathSuchAs1') {
                return inputFile;
              }
              if (inputFile === '-') {
                return '-';
              }
              if (fs.existsSync(inputFile)) {
                return inputFile;
              }
              throw new AbrgError({
                messageId: AbrgMessage.CANNOT_FIND_INPUT_FILE,
                level: AbrgErrorLevel.ERROR,
              });
            }
          })
          .positional('outputFile', {
            describe: AbrgMessage.toString(AbrgMessage.CLI_GEOCODE_OUTPUT_FILE),
            type: 'string',
            default: undefined,
          })
      },
      async argv => {
        
        // Prevent users from running this command without options.
        // i.e. $> abrg
        if (!argv['inputFile']) {
          return;
        }

        const container = await setupContainer({
          dataDir: argv.dataDir,
          ckanId: argv.resource,
        });

        await onGeocoding({
          source: argv['inputFile'] as string,
          destination: argv['outputFile'] as string | undefined,
          format: argv.format as OutputFormat,
          fuzzy: argv.fuzzy,
          container,
        });
      }
    )
    .fail((msg: string, e: Error, yargs: yargs.Argv<{}>) => {
      if (yargs.length <= 2) {
        // Show help if no options are provided.
        yargs.showVersion((version: string) => {
          console.error(`====================================`);
          console.error(`= abr-geocoder version: ${version}`);
          console.error(`====================================`);
        });
        yargs.showHelp();
        return;
      }

      // Otherwise, show the error message
      console.error(`[error] ${msg}`);
    })
    .parse(hideBin(processArgv), {}, (err: Error | undefined, argv: ArgumentsCamelCase, output: string) => {
      console.log(argv);
    });
};
if (process.env.NODE_ENV !== 'test') {
  main(...process.argv);
}
