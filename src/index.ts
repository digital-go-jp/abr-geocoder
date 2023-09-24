#!/usr/bin/env node

// reflect-metadata is necessary for DI
import 'reflect-metadata';

import os from 'node:os';
import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { onDownloadAction } from './controllers/onDownloadAction';
import { onGeocodingAction } from './controllers/onGeocoding';
import {
  AbrgError,
  AbrgErrorLevel,
  AbrgMessage,
  OutputFormat,
  bubblingFindFile,
} from './domain';
import { parsePackageJson, setupContainer } from './interface-adapter';
import confirm from '@inquirer/confirm';
import {Database} from 'better-sqlite3';
import { CkanDownloader } from './usecase';
import { SingleBar } from 'cli-progress';


const dataDir = path.join(os.homedir(), '.abr-geocoder');
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
            default: dataDir,
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
        })

        const downloader = new CkanDownloader({
          db: container.resolve<Database>('DATABASE'),
          userAgent: container.resolve<string>('USER_AGENT'),
          datasetUrl: container.resolve<string>('DATASET_URL'),
          ckanId,
          dataDir: argv.dataDir,
        });
        const isUpdateAvailable = await downloader.updateCheck();
        
        if (!isUpdateAvailable) {
          console.info(
            AbrgMessage.toString(AbrgMessage.ERROR_NO_UPDATE_IS_AVAILABLE),
          );
          return;
        }
        console.info(
          AbrgMessage.toString(AbrgMessage.NEW_DATASET_IS_AVAILABLE),
        );
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

        const progress = container.resolve<SingleBar>('PROGRESS_BAR');
        
        const workDir = argv.workDir as string || dataDir;

        const downloader = new CkanDownloader({
          db: container.resolve<Database>('DATABASE'),
          userAgent: container.resolve<string>('USER_AGENT'),
          datasetUrl: container.resolve<string>('DATASET_URL'),
          ckanId,
          dataDir: workDir,
        });
        const isUpdateAvailable = await downloader.updateCheck();
        
        if (!isUpdateAvailable) {
          console.info(
            AbrgMessage.toString(AbrgMessage.ERROR_NO_UPDATE_IS_AVAILABLE),
          );
          return;
        }

        downloader.on('download:start', ({
          position,
          length,
        }: {
          position: number,
          length: number,
        }) => {
          progress.start(length, position);
        });
        downloader.on('download:data', (chunkSize: number) => {
          progress.increment(chunkSize);
        })
        downloader.on('download:end', () => {
          progress.stop();
        })
        await downloader.download();

        
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
            default: dataDir,
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
        let inputFile = '-';
        if (typeof argv['inputFile'] === 'string') {
          inputFile = argv['inputFile'] as string;
        }
        await onGeocodingAction({
          source: inputFile,
          destination: (argv['outputFile'] as string) || '',
          dataDir: argv.workDir || dataDir,
          resourceId: argv.resource || 'ba000001',
          format: argv.format as OutputFormat,
          fuzzy: argv.fuzzy || '?',
        });
      }
    )
    .parse();
};
main();
