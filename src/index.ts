#!/usr/bin/env node

// reflect-metadata is necessary for DI
import 'reflect-metadata';

import os from 'node:os';
import path from 'node:path';
import yargs from 'yargs';
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


const DEFAULT_DATA_DIR = path.join(os.homedir(), '.abr-geocoder');
const terminalWidth = Math.min(yargs.terminalWidth(), 120);

const main = async () => {

  const packageJsonFilePath = await bubblingFindFile(__dirname, 'package.json');
  if (!packageJsonFilePath) {
    throw new AbrgError({
      messageId: AbrgMessage.CANNOT_FIND_PACKAGE_JSON_FILE,
      level: AbrgErrorLevel.ERROR,
    });
  }

  const { version } = parsePackageJson({
    filePath: packageJsonFilePath,
  });

  /**
   * CLIパーサー (通常のプログラムのエントリーポイント)
   */
  yargs(hideBin(process.argv))
    .version(version)
    .wrap(terminalWidth)
    .scriptName('abrg')

    /**
     * abrg update-check
     * ローカルDBと比較して新しいデータセットの有無を調べる
     */
    .command(
      'update-check',
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
        })
      }
    )

    /**
     * abrg download
     * データセットをダウンロードする
     */
    .command(
      'download',
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
          })
          .option('force', {
            alias: 'f',
            type: 'boolean',
            describe: AbrgMessage.toString(AbrgMessage.CLI_DOWNLOAD_FORCE_DESC),
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
          dataDir: argv.workDir as string || DEFAULT_DATA_DIR,
        });
      }
    )

    /**
     * abrg
     * 入力されたファイル、または標準入力から与えられる住所をジオコーディングする
     */
    .command(
      '$0 <inputFile> [<outputFile>]',
      AbrgMessage.toString(AbrgMessage.CLI_GEOCODE_DESC),
      (yargs: yargs.Argv) => {
        return yargs
          .option('fuzzy', {
            type: 'string',
            default: '?',
            describe: AbrgMessage.toString(
              AbrgMessage.CLI_GEOCODE_FUZZY_OPTION
            ),
          })
          .option('workDir', {
            alias: 'w',
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
          .positional('<inputFile>', {
            describe: AbrgMessage.toString(AbrgMessage.CLI_GEOCODE_INPUT_FILE),
            default: '-',
          })
          .positional('[<outputFile>]', {
            describe: AbrgMessage.toString(AbrgMessage.CLI_GEOCODE_OUTPUT_FILE),
            default: '',
          });
      },
      async argv => {
        const dataDir = argv.workDir || DEFAULT_DATA_DIR;

        const ckanId = argv.resource;
        const container = await setupContainer({
          dataDir,
          ckanId,
        });

        let inputFile = '-';
        if (typeof argv['inputFile'] === 'string') {
          inputFile = argv['inputFile'] as string;
        }
        await onGeocoding({
          source: inputFile,
          destination: (argv['outputFile'] as string) || '',
          dataDir,
          resourceId: argv.resource || 'ba000001',
          format: argv.format as OutputFormat,
          fuzzy: argv.fuzzy || '?',
          container,
        });
      }
    )
    .parse();
};
main();
