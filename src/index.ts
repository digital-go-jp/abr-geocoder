#!/usr/bin/env node

// reflect-metadata is necessary for DI
import 'reflect-metadata';

import os from 'node:os';
import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { AbrgMessage } from './domain';
import { parsePackageJson } from './interface-adapter';
import {
  OutputFormat,
  onDownloadAction,
  onGeocodingAction,
  onUpdateCheckAction,
} from './usecase';

const dataDir = path.join(os.homedir(), '.abr-geocoder');
const terminalWidth = Math.min(yargs.terminalWidth(), 120);

const { version } = parsePackageJson({
  filePath: path.join(__dirname, '..', '..', 'package.json'),
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
          default: dataDir,
          describe: AbrgMessage.toString(AbrgMessage.CLI_COMMON_DATADIR_OPTION),
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
      await onUpdateCheckAction({
        dataDir: argv.dataDir,
        ckanId: argv.resource,
      }).catch((error: Error) => {
        console.error(error);
      });
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
          default: dataDir,
          describe: AbrgMessage.toString(AbrgMessage.CLI_COMMON_DATADIR_OPTION),
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
      await onDownloadAction({
        dataDir: argv.dataDir,
        ckanId: argv.resource,
      }).catch((error: Error) => {
        console.error(error);
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
          describe: AbrgMessage.toString(AbrgMessage.CLI_GEOCODE_FUZZY_OPTION),
        })
        .option('workDir', {
          alias: 'w',
          type: 'string',
          default: dataDir,
          describe: AbrgMessage.toString(AbrgMessage.CLI_COMMON_DATADIR_OPTION),
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
          default: 'table',
          describe: AbrgMessage.toString(AbrgMessage.CLI_GEOCODE_FORMAT_OPTION),
          choices: ['csv', 'table', 'json', 'geojson'],
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
      await onGeocodingAction({
        source: (argv.inputFile as string) || '-',
        destination: '',
        dataDir: argv.workDir || dataDir,
        resourceId: argv.resource || 'ba000001',
        format: OutputFormat[argv.format as keyof typeof OutputFormat],
        fuzzy: argv.fuzzy || '?',
      });
    }
  )
  .parse();
