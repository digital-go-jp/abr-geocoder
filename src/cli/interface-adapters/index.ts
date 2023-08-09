#!/usr/bin/env node

// reflect-metadata is necessary for DI
import "reflect-metadata";

import os from 'node:os';
import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { parsePackageJson } from "../infrastructure";
import { onDownloadAction } from "./onDownloadAction";
import { onUpdateCheckAction } from "./onUpdateCheckAction";
import { OutputFormat, onGeocodingAction } from "./onGeocodingAction";
import { AbrgMessage } from '../domain';

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
    AbrgMessage.toString(AbrgMessage.CLI_UPDATE_CHECK_DESC),
    {
      dataDir: {
        alias: 'd',
        default: dataDir,
        describe: AbrgMessage.toString(AbrgMessage.CLI_COMMON_DATADIR_OPTION),
      },
      resource: {
        alias: 'r',
        default: 'ba000001',
        describe: AbrgMessage.toString(AbrgMessage.CLI_COMMON_RESOURCE_OPTION),
      },
    },
    async (argv) => {
      await onUpdateCheckAction({
        dataDir: argv.dataDir,
        ckanId: argv.resource,
      })
      .catch((error: Error) => {
        console.error(error);
      });
    }
  )
  .command(
    'download',
    AbrgMessage.toString(AbrgMessage.CLI_DOWNLOAD_DESC),
    {
      dataDir: {
        alias: 'd',
        default: dataDir,
        describe: AbrgMessage.toString(AbrgMessage.CLI_COMMON_DATADIR_OPTION),
      },
      resource: {
        alias: 'r',
        default: 'ba000001',
        describe: AbrgMessage.toString(AbrgMessage.CLI_COMMON_RESOURCE_OPTION),
      },
    },
    async (argv) => {
      await onDownloadAction({
        dataDir: argv.dataDir,
        ckanId: argv.resource,
      })
      .catch((error: Error) => {
        console.error(error);
      });
    }
  )
  .command(
    '$0 <inputFile> [<outputFile>]',
    AbrgMessage.toString(AbrgMessage.CLI_GEOCODE_DESC),
    (yargs: yargs.Argv) => {
      return yargs
        .option("fuzzy", {
          type: 'string',
          default: '?',
          describe: AbrgMessage.toString(AbrgMessage.CLI_GEOCODE_FUZZY_OPTION),
        })
        .option("workDir", {
          alias: 'w',
          type: 'string',
          default: dataDir,
          describe: AbrgMessage.toString(AbrgMessage.CLI_COMMON_DATADIR_OPTION),
        })
        .option("resource", {
          alias: 'r',
          type: 'string',
          default: 'ba000001',
          describe: AbrgMessage.toString(AbrgMessage.CLI_COMMON_RESOURCE_OPTION),
        })
        .option("format", {
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
        })
    },
    async (argv) => {
      console.log(argv);
      await onGeocodingAction({
        source: argv['<inputFile>'] || '-',
        destination: '',
        dataDir: argv.workDir || dataDir,
        resourceId: argv.resource || 'ba000001',
        format: OutputFormat[argv.format as keyof typeof OutputFormat],
        fuzzy: argv.fuzzy || '?',
      });
    }
  )
  .parse();
