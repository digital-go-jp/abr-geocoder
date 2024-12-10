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
import { countRequests } from '@domain/services/count-requests';
import { createSingleProgressBar } from '@domain/services/progress-bars/create-single-progress-bar';
import { resolveHome } from '@domain/services/resolve-home';
import { CommentFilterTransform } from '@domain/services/transformations/comment-filter-transform';
import { LineByLineTransform } from '@domain/services/transformations/line-by-line-transform';
import { StreamCounter } from '@domain/services/transformations/stream-counter';
import { upwardFileSearch } from '@domain/services/upward-file-search';
import { AbrgError, AbrgErrorLevel } from '@domain/types/messages/abrg-error';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { OutputFormat } from '@domain/types/output-format';
import { SearchTarget } from '@domain/types/search-target';
import { FormatterProvider } from '@interface/format/formatter-provider';
import { AbrGeocoder } from '@usecases/geocode/abr-geocoder';
import { AbrGeocoderStream } from '@usecases/geocode/abr-geocoder-stream';
import { AbrGeocoderDiContainer } from '@usecases/geocode/models/abr-geocoder-di-container';
import { createGeocodeCaches } from '@usecases/geocode/services/create-geocode-caches';
import { getReadStreamFromSource } from '@usecases/geocode/services/get-read-stream-from-source';
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

/**
 * abrg
 * データセットをダウンロードする
 */
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
    const isSilentMode = argv.silent || destination === '-' || destination === undefined;
    // ワークスペース
    const abrgDir = resolveHome(argv.abrgDir || EnvProvider.DEFAULT_ABRG_DIR);
    // デバッグフラグ
    const debug = argv.debug === true;
    // ワイルドカードマッチングとして取り扱う１文字
    const fuzzy = argv.fuzzy || DEFAULT_FUZZY_CHAR;
    // 検索モード
    const searchTarget = argv.target || SearchTarget.ALL;
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

      const result = fs.createWriteStream(path.normalize(destination), {
        encoding: 'utf8',
        highWaterMark: 64 * 1024 * 1024, // 64MB
      });
      return result;
    })(destination);

    // ルートディレクトリを探す
    const rootDir = upwardFileSearch(__dirname, 'build');
    if (!rootDir) {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_FIND_THE_ROOT_DIR,
        level: AbrgErrorLevel.ERROR,
      });
    }

    // DIコンテナをセットアップする
    // 初期設定値を DIコンテナに全て詰め込む
    const container = new AbrGeocoderDiContainer({
      database: {
        type: 'sqlite3',
        dataDir: path.join(abrgDir, 'database'),
      },
      debug,
      cacheDir: path.join(abrgDir, 'cache'),
    });

    // スレッド数を決める
    const numOfThreads = (() => {
      if (process.env.JEST_WORKER_ID) {
        // メインスレッドで処理を行う
        return 1;
      }
      // バックグラウンドスレッドを用いる
      return container.env.availableParallelism();
    })();

    // キャッシュデータの作成と、ファイルからリクエスト数のカウントを並行して行う
    const createCacheTask = createGeocodeCaches({
      container,
      isSilentMode,
      numOfThreads,
    });

    // ファイルの行数を数える
    const countNumOfLinesTask = (async () => {
      if (source !== STDIN_FILEPATH) {
        return countRequests(source);
      } else {
        return Number.POSITIVE_INFINITY;
      }
    })();

    const [numOfLinesInFiles, _ignore] = await Promise.all([
      countNumOfLinesTask,
      createCacheTask,
    ])

    // 合計のリクエスト数をセット
    const geocodeProgressBar = isSilentMode ? undefined : createSingleProgressBar('geocoding: {bar} {percentage}% | {value}/{total} | ETA: {eta_formatted}');
    geocodeProgressBar?.start(numOfLinesInFiles, 0);

    // ジオコーダの作成
    const geocoder = await AbrGeocoder.create({
      container,
      numOfThreads,
      isSilentMode,
    });

    // ジオコーディング・ストリーマの作成
    const geocoderStream = new AbrGeocoderStream({
      geocoder,
      fuzzy,
      searchTarget,
      highWatermark: numOfThreads * 500,
    });

    // プログレスバーをアップデート
    let totalPause = 0;
    const streamCounter = new StreamCounter({
      fps: 10,
      callback(current) {
        geocodeProgressBar?.update(current, {
          totalPause,
        });
      },
    });

    // ジオコーディングを行う
    const lineByLine = new LineByLineTransform();
    const commentFilter = new CommentFilterTransform();
    const onPause = () => {
      totalPause++;
      return !srcStream.isPaused() && srcStream.pause();
    };
    const onResume = () => {
      return srcStream.isPaused() && srcStream.resume();
    };
    geocoderStream.on('pause', onPause);
    geocoderStream.on('resume', onResume);
   
    await streamPromises.pipeline(
      // 入力ソースからデータの読み込み
      srcStream,
      // 1行単位に分解する
      lineByLine,
      // コメントを取り除く
      commentFilter,
      // ジオコーディングを行う
      geocoderStream,
      // プログレスバーをアップデート
      streamCounter,
      // 出力を整形する
      formatter,
      // 出力先に書き込む
      outputStream,
    );

    // workerPool.close();
    geocoder.close();
    geocodeProgressBar?.stop();
    
    // ジオコーディングにかかる時間を表示
    if (argv.debug) {
      console.timeEnd("geocoding");
    }
  },
};

export default geocodeCommand;
