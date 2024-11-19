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
import { DEFAULT_FUZZY_CHAR, STDIN_FILEPATH } from '@config/constant-values';
import { EnvProvider } from '@domain/models/env-provider';
import { createSingleProgressBar } from '@domain/services/progress-bars/create-single-progress-bar';
import { WorkerThreadPool } from '@domain/services/thread/worker-thread-pool';
import { StreamCounter } from '@domain/services/transformations/stream-counter';
import { AbrgError, AbrgErrorLevel } from '@domain/types/messages/abrg-error';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { OutputFormat } from '@domain/types/output-format';
import { SearchTarget } from '@domain/types/search-target';
import { Query, QueryJson } from '@usecases/geocode/models/query';
import path from 'node:path';
import fs from 'node:fs';
import { Readable, Transform, Writable } from 'node:stream';
import streamPromises from 'node:stream/promises';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { getReadStreamFromSource } from '@usecases/geocode/services/get-read-stream-from-source';
import { LineByLineTransform } from '@domain/services/transformations/line-by-line-transform';
import { CommentFilterTransform } from '@domain/services/transformations/comment-filter-transform';
import { AbrGeocoderStream } from '@usecases/geocode/abr-geocoder-stream';
import { AbrGeocoder } from '@usecases/geocode/abr-geocoder';
import { AbrGeocoderDiContainer } from '@usecases/geocode/models/abr-geocoder-di-container';
import { FormatterProvider } from '@interface/format/formatter-provider';


export type TestCommandArgv = {
  abrgDir?: string; // 'abrgDir' または 'd' はオプショナル
  d?: string; // alias 'd' もオプショナル

  target?: SearchTarget; // 'target' はオプショナル

  fuzzy?: string; // 'fuzzy' はオプショナル

  debug?: boolean; // 'debug' はオプショナル

  silent?: boolean; // 'silent' はオプショナル

  format?: OutputFormat; // 'format' または 'f' はオプショナル
  f?: OutputFormat; // alias 'f' もオプショナル

  inputFile?: string; // 'inputFile' は必須
  outputFile?: string; // 'outputFile' はオプショナル
};

/**
 * abrg test
 * データセットをダウンロードする
 */
const testCommand: CommandModule = {
  command: '$0 test <inputFile> [outputFile] [options]',
  describe: AbrgMessage.toString(AbrgMessage.CLI_DOWNLOAD_DESC),

  builder: (yargs: Argv): Argv<TestCommandArgv> => {
    return yargs
      .option('abrgDir', {
        alias: 'd',
        type: 'string',
        default: EnvProvider.DEFAULT_ABRG_DIR,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_COMMON_DATADIR_OPTION,
        ),
      })
      .option('target', {
        type: 'string',
        default: SearchTarget.ALL,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_GEOCODE_TARGET_OPTION,
        ),
        choices: [SearchTarget.ALL, SearchTarget.RESIDENTIAL, SearchTarget.PARCEL],
      })
      .option('fuzzy', {
        type: 'string',
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_GEOCODE_FUZZY_OPTION,
        ),
        coerce: fuzzy => {
          if (fuzzy.length !== 1) {
            console.error(
              AbrgMessage.toString(AbrgMessage.CLI_GEOCODE_FUZZY_CHAR_ERROR),
            );
            process.exit(1);
          }
          return fuzzy;
        },
      })
      .option('format', {
        alias: 'f',
        type: 'string',
        default: OutputFormat.JSON,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_GEOCODE_FORMAT_OPTION,
        ),
        choices: [
          OutputFormat.CSV,
          OutputFormat.JSON,
          OutputFormat.NDJSON,
          OutputFormat.GEOJSON,
          OutputFormat.NDGEOJSON,
          OutputFormat.SIMPLIFIED,
        ],
      })
      .positional('inputFile', {
        describe: AbrgMessage.toString(AbrgMessage.CLI_GEOCODE_INPUT_FILE),
        type: 'string',
        coerce: (inputFile: string) => {
          if (inputFile === STDIN_FILEPATH) {
            return inputFile;
          }

          if (fs.existsSync(inputFile)) {
            return inputFile;
          }
          throw new AbrgError({
            messageId: AbrgMessage.CANNOT_FIND_INPUT_FILE,
            level: AbrgErrorLevel.ERROR,
          });
        },
      })
      .positional('outputFile', {
        describe: AbrgMessage.toString(AbrgMessage.CLI_GEOCODE_OUTPUT_FILE),
        type: 'string',
        default: undefined,
      })
      .option('debug', {
        type: 'boolean',
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_COMMON_DEBUG_OPTION,
        ),
      })
      .option('silent', {
        type: 'boolean',
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_COMMON_SILENT_OPTION,
        ),
      });
  },

  handler: async (argv: ArgumentsCamelCase<TestCommandArgv>) => {

    let readIdx = 0;
    let writeIdx = 0;
    // プログレスバーの作成。
    // silentの指定がなく、ファイル入力の場合のみ作成される。
    const progressBar = (argv.silen) ?
      undefined : createSingleProgressBar(' {bar} {percentage}% | {value}/{total} ({totalPause}) | ETA: {eta_formatted}');
    progressBar?.start(22500835, 0, {
      'message': 'preparing...',
      readIdx,
      writeIdx,
    });
    
    let totalPause = 0;
    const streamCounter = new StreamCounter({
      fps: 10,
      callback(current) {
        progressBar?.update(current, {
          totalPause,
        });
      },
    });

    const source = argv['inputFile'] as string;
    const srcStream = getReadStreamFromSource(source);
    const lineByLine = new LineByLineTransform();
    
    const container = new AbrGeocoderDiContainer({
      cacheDir: `./db/cache`,
      database: {
        type: 'sqlite3',
        dataDir: './db/database'
      },
      debug: true,
    });
    const geocoder = await AbrGeocoder.create({
      container,
      numOfThreads: 10
    })
    const geocoderStream = new AbrGeocoderStream({
      geocoder,
      fuzzy: argv.fuzzy || DEFAULT_FUZZY_CHAR,
      searchTarget: argv.target || SearchTarget.ALL,
    })



    // const workerPool = new WorkerThreadPool<null, string, QueryJson>({
    //   filename: path.join(__dirname, '..', '..','..', 'usecases', 'geocode', 'worker',  'test-worker'),
    //   initData: null,
    //   maxConcurrency: 10,
    //   maxTasksPerWorker: 10,
    // });
    // const geocoder = new Transform({
    //   objectMode: true,
    //   allowHalfOpen: true,
    //   transform(chunk, _encoding, callback) {

    //     if (readIdx - writeIdx >= 3000) {
    //       srcStream.pause();
    //     } 
    //     callback();
    //     readIdx++;

    //     workerPool.run(chunk.toString()).then(resultJSON => {
    //       const result = Query.from(resultJSON);
          
    //       writeIdx++;
    //       if (srcStream.isPaused() && readIdx - writeIdx < 500) {
    //         srcStream.resume();
    //       } 
    //       this.push(result);
    //     });
    //   },
    // })


    const outputStream = fs.createWriteStream(argv.outputFile || '/dev/null', {
      highWaterMark: 64 * 1024 * 1024
    });
    const commentFilter = new CommentFilterTransform();
    const format = OutputFormat.JSON;
    const formatter = FormatterProvider.get({
      type: format,
      debug: false,
    });
    const onPause = () => {
      totalPause++;
      !srcStream.isPaused() && srcStream.pause();
    };
    const onResume = () => {
      srcStream.isPaused() && srcStream.resume();
    };
    geocoderStream.on('pause', onPause);
    geocoderStream.on('resume', onResume);
   
    await streamPromises.pipeline(
      srcStream,
      lineByLine,
      commentFilter,
      geocoderStream,
      streamCounter,
      formatter,
      outputStream,
    );

    // workerPool.close();
    geocoder.close();
    progressBar?.stop();
  },
};

export default testCommand;
