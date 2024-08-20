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
import { DEFAULT_FUZZY_CHAR, SINGLE_DASH_ALTERNATIVE } from '@config/constant-values';
import { EnvProvider } from '@domain/models/env-provider';
import { countRequests } from '@domain/services/count-requests';
import { createSingleProgressBar } from '@domain/services/progress-bars/create-single-progress-bar';
import { resolveHome } from '@domain/services/resolve-home';
import { upwardFileSearch } from '@domain/services/upward-file-search';
import { AbrgError, AbrgErrorLevel } from '@domain/types/messages/abrg-error';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { OutputFormat } from '@domain/types/output-format';
import { SearchTarget } from '@domain/types/search-target';
import { FormatterProvider } from '@interface/format/formatter-provider';
import { AbrGeocodeStream } from '@usecases/geocode/abr-geocode-stream';
import { getReadStreamFromSource } from '@usecases/geocode/services/get-read-stream-from-source';
import { LineStream } from 'byline';
import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import streamPromises from 'node:stream/promises';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';

/**
 * abrg geocode
 * 入力されたファイル、または標準入力から与えられる住所をジオコーディングする
 */
export type GeocodeCommandArgv = {
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

const geocodeCommand: CommandModule = {
  command: '$0 <inputFile> [outputFile] [options]',
  describe: AbrgMessage.toString(AbrgMessage.CLI_GEOCODE_DESC),

  builder: (yargs: Argv): Argv<GeocodeCommandArgv> => {
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
          if (inputFile === SINGLE_DASH_ALTERNATIVE) {
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

  handler: async (argv: ArgumentsCamelCase<GeocodeCommandArgv>) => {
    // Prevent users from running this command without options.
    // i.e. $> abrg
    if (!argv['inputFile']) {
      return;
    }
    const source = argv['inputFile'] as string;
    const destination = argv['outputFile'] as string | undefined;

    // ジオコーディングにかかる時間を表示
    if (argv.debug) {
      console.time("geocoding");
    }

    // プログレスバーの作成。
    // silentの指定がなく、ファイル入力の場合のみ作成される。
    const progressBar = (argv.silent || destination === '-' || destination === undefined) ?
      undefined : createSingleProgressBar();
    progressBar?.start(2, 0);
    if (progressBar) {
      progressBar.update(1, {
        'message': 'preparing...',
      });
    }

    // ワークスペース
    const abrgDir = resolveHome(argv.abrgDir || EnvProvider.DEFAULT_ABRG_DIR);

    const debug = argv.debug === true;

    // 入力元の選択
    const srcStream = getReadStreamFromSource(source);
    // Geocoding結果を出力するフォーマッタ
    const format = argv.format || OutputFormat.JSON;
    const formatter = FormatterProvider.get({
      type: format,
      debug,
    });
    // 出力先（ファイル or stdout）の選択
    const outputStream: Writable = (destination => {
      if (destination === '' || destination === undefined) {
        // ThreadGeocodeTransformで、各スレッドがstdoutを使用しようとして、
        // イベントリスナーを取り合いになるため、以下の警告が発生する模様。
        // 動作的には問題ないので、 process.stdout.setMaxListeners(0) として警告を殺す。
        //
        // (node:62246) MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
        // 11 unpipe listeners added to [WriteStream]. Use emitter.setMaxListeners() to increase limit
        process.stdout.setMaxListeners(0);
        return process.stdout;
      }

      // メモリを節約するため、あまり溜め込まないようにする
      // ReadableStream において objectMode = true のときの highWaterMark が 16 なので
      // 固定値で16にする
      const result = fs.createWriteStream(path.normalize(destination), {
        encoding: 'utf8',
        highWaterMark: 16,
      });
      return result;
    })(destination);

    // ルートディレクトリを探す
    const rootDir = await upwardFileSearch(__dirname, 'build');
    if (!rootDir) {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_FIND_THE_ROOT_DIR,
        level: AbrgErrorLevel.ERROR,
      });
    }

    // ジオコーダーの作成と、ファイルからリクエスト数のカウントを並行して行う
    const tasks: [
      Promise<AbrGeocodeStream>,
      Promise<number>
    ] = [
      // ジオコーダーの作成
      AbrGeocodeStream.create({
        fuzzy: argv.fuzzy || DEFAULT_FUZZY_CHAR,
        searchTarget: argv.target || SearchTarget.ALL,
        cacheDir: path.join(abrgDir, 'cache'),
        database: {
          type: 'sqlite3',
          dataDir: path.join(abrgDir, 'database'),
          schemaDir: path.join(rootDir, 'schemas', 'sqlite3'),
        },
        debug,
        progress(current: number) {
          progressBar?.update(current);
        },
      }),
      
      (() => {
        if (source !== '-' && progressBar) {
          // ファイルの場合は、先に合計数を数えておく
          return countRequests(source);
        } else {
          return Promise.resolve(0);
        }
      })(),
    ];
    const [geocoder, total] = await Promise.all(tasks);
    if (progressBar) {
      progressBar.update(0, {
        message: 'geocoding...',
      });
      // 合計のリクエスト数をセット
      progressBar?.setTotal(total);
    }
    
    // ジオコーディングを行う
    const lineByLine = new LineStream();
    await streamPromises.pipeline(
      srcStream,
      lineByLine,
      geocoder,
      formatter,
      outputStream,
    );

    progressBar?.stop();

    // ジオコーディングにかかる時間を表示
    if (argv.debug) {
      console.timeEnd("geocoding");
    }
  },
};

export default geocodeCommand;
