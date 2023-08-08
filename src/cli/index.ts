#!/usr/bin/env node

// reflect-metadata is necessary for DI
import "reflect-metadata";

import os from 'node:os';
import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { parsePackageJson } from "./infrastructure";
import { onDownloadAction } from "./usecase/onDownloadAction";
import { onUpdateCheckAction } from "./usecase/onUpdateCheckAction";
import StrResource from './usecase/strResource';
import { MESSAGE } from './usecase/strResource/locales';

const strResource = StrResource();
const dataDir = path.join(os.homedir(), '.abr-geocoder');
const terminalWidth = Math.min(yargs.terminalWidth(), 120);

const {version} = parsePackageJson({
  filePath: path.join(__dirname, '..', '..', 'package.json'),
});

yargs(hideBin(process.argv))
  .version(version)
  .wrap(terminalWidth)
  .scriptName('abrg')
  .command(
    'update-check',
    strResource(MESSAGE.CLI_UPDATE_CHECK_DESC),
    {
      dataDir: {
        alias: 'd',
        default: dataDir,
        describe: strResource(MESSAGE.CLI_COMMON_DATADIR_OPTION),
      },
      source: {
        alias: 's',
        default: 'ba000001',
        describe: strResource(MESSAGE.CLI_COMMON_SOURCE_OPTION),
      },
    },
    async (argv) => {
      await onUpdateCheckAction({
        dataDir: argv.dataDir,
        resourceId: argv.source,
      })
      .catch((error: Error) => {
        console.error(error);
      });
    }
  )
  .command(
    'download',
    strResource(MESSAGE.CLI_DOWNLOAD_DESC),
    {
      dataDir: {
        alias: 'd',
        default: dataDir,
        describe: strResource(MESSAGE.CLI_COMMON_DATADIR_OPTION),
      },
      source: {
        alias: 's',
        default: 'ba000001',
        describe: strResource(MESSAGE.CLI_COMMON_SOURCE_OPTION),
      },
    },
    async (argv) => {
      await onDownloadAction({
        dataDir: argv.dataDir,
        resourceId: argv.source,
      })
      .catch((error: Error) => {
        console.error(error);
      });
    }
  )
  .command(
    '$0 <inputFile>',
    strResource(MESSAGE.CLI_GEOCODE_DESC),
    (yargs: yargs.Argv) => {
      return yargs
        .option("fuzzy", {
          type: 'string',
          default: '?',
          describe: strResource(MESSAGE.CLI_GEOCODE_FUZZY_OPTION),
        })
        .option("workDir", {
          alias: 'w',
          type: 'string',
          default: dataDir,
          describe: strResource(MESSAGE.CLI_COMMON_DATADIR_OPTION),
        })
        .option("source", {
          alias: 's',
          type: 'string',
          default: 'ba000001',
          describe: strResource(MESSAGE.CLI_COMMON_SOURCE_OPTION),
        })
        .option("format", {
          alias: 'f',
          type: 'string',
          default: 'table',
          describe: strResource(MESSAGE.CLI_GEOCODE_FORMAT_OPTION),
          choices: ['text', 'csv', 'table', 'json', 'geojson']
        })
        .positional('<file>', {
          describe: strResource(MESSAGE.CLI_GEOCODE_INPUT_FILE)
        })
    },
    async (argv) => {
      if (!process.stdin.isTTY) {
        //  await onGeocoding(argv);
        return;
      }
    }
  )
  .parse();