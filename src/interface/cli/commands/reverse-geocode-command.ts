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
import { STDIN_FILEPATH } from '@config/constant-values';
import { CACHE_CREATE_PROGRESS_BAR, GEOCODING_PROGRESS_BAR } from '@config/progress-bar-formats';
import { EnvProvider } from '@domain/models/env-provider';
import { countRequests } from '@domain/services/count-requests';
import { createSingleProgressBar } from '@domain/services/progress-bars/create-single-progress-bar';
import { resolveHome } from '@domain/services/resolve-home';
import { CoordinateParsingTransform } from '@domain/services/transformations/coordinate-parsing-transform';
import { LineByLineTransform } from '@domain/services/transformations/line-by-line-transform';
import { StreamCounter } from '@domain/services/transformations/stream-counter';
import { upwardFileSearch } from '@domain/services/upward-file-search';
import { AbrgError, AbrgErrorLevel } from '@domain/types/messages/abrg-error';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { OutputFormat } from '@domain/types/output-format';
import { SearchTarget } from '@domain/types/search-target';
import { FormatterProvider } from '@interface/format/formatter-provider';
import { AbrGeocoder } from '@usecases/geocode/abr-geocoder';
import { AbrReverseGeocoderStream } from '@usecases/geocode/abr-reverse-geocoder-stream';
import { AbrGeocoderDiContainer } from '@usecases/geocode/models/abr-geocoder-di-container';
// import { createGeocodeCaches } from '@usecases/geocode/services/create-geocode-caches';
import { getReadStreamFromSource } from '@usecases/geocode/services/get-read-stream-from-source';
import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import streamPromises from 'node:stream/promises';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';

export type ReverseGeocodeCommandArgv = {
  abrgDir?: string; // 'abrgDir' または 'd' はオプショナル
  d?: string; // alias 'd' もオプショナル

  lat?: number; // 'lat' - 単発実行時は必須、ファイル入力時は不要
  lon?: number; // 'lon' - 単発実行時は必須、ファイル入力時は不要

  limit?: number; // 'limit' または 'l' はオプショナル
  l?: number; // alias 'l' もオプショナル

  target?: SearchTarget; // 'target' または 't' はオプショナル
  t?: SearchTarget; // alias 't' もオプショナル

  format?: OutputFormat; // 'format' または 'f' はオプショナル
  f?: OutputFormat; // alias 'f' もオプショナル

  debug?: boolean; // 'debug' はオプショナル
  silent?: boolean; // 'silent' はオプショナル

  spatialIndex?: boolean; // 'spatialIndex' - R-tree使用フラグ
  haversine?: boolean; // 'haversine' - ハヴァーサイン公式強制使用フラグ

  inputFile?: string; // ファイル入力時の入力ファイル
  outputFile?: string; // ファイル入力時の出力ファイル
};

/**
 * abrg reverse
 * 座標から住所を取得する逆ジオコーディング機能
 * 単発実行とファイル一括処理の両方をサポート
 */
const reverseGeocodeCommand: CommandModule<{}, ReverseGeocodeCommandArgv> = {
  command: 'reverse [inputFile] [outputFile]',
  aliases: ['r'],
  describe: '座標から住所を取得します（逆ジオコーディング）',

  builder: (yargs: Argv): Argv<ReverseGeocodeCommandArgv> => {
    return yargs
      .option('abrgDir', {
        alias: 'd',
        type: 'string',
        default: EnvProvider.DEFAULT_ABRG_DIR,
        describe: AbrgMessage.toString(
          AbrgMessage.CLI_COMMON_DATADIR_OPTION,
        ),
      })
      .option('lat', {
        type: 'number',
        describe: '緯度（十進度数、-90から90まで）単発実行時のみ',
        coerce: (lat: number) => {
          if (isNaN(lat) || lat < -90 || lat > 90) {
            console.error('latパラメータは-90から90の範囲で指定してください');
            process.exit(1);
          }
          return lat;
        },
      })
      .option('lon', {
        type: 'number',
        describe: '経度（十進度数、-180から180まで）単発実行時のみ',
        coerce: (lon: number) => {
          if (isNaN(lon) || lon < -180 || lon > 180) {
            console.error('lonパラメータは-180から180の範囲で指定してください');
            process.exit(1);
          }
          return lon;
        },
      })
      .option('limit', {
        alias: 'l',
        type: 'number',
        default: 1,
        describe: '返却する結果の最大数（1から5まで）',
        coerce: (limit: number) => {
          if (isNaN(limit) || limit < 1 || limit > 5) {
            console.error('limitパラメータは1から5の範囲で指定してください');
            process.exit(1);
          }
          return limit;
        },
      })
      .option('target', {
        alias: 't',
        type: 'string',
        default: SearchTarget.ALL,
        describe: '検索対象（all, residential, parcel）',
        choices: [SearchTarget.ALL, SearchTarget.RESIDENTIAL, SearchTarget.PARCEL],
      })
      .option('format', {
        alias: 'f',
        type: 'string',
        default: OutputFormat.GEOJSON,
        describe: '出力形式',
        choices: [
          OutputFormat.JSON,
          OutputFormat.CSV,
          OutputFormat.NDJSON,
          OutputFormat.GEOJSON,
          OutputFormat.NDGEOJSON,
          OutputFormat.SIMPLIFIED,
        ],
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
      })
      .option('spatialIndex', {
        type: 'boolean',
        default: true,
        describe: 'R木空間インデックスを使用（高速、デフォルト）',
      })
      .option('haversine', {
        type: 'boolean',
        default: false,
        describe: 'ハヴァーサイン公式を使用（--spatialIndexと併用不可）',
      })
      .positional('inputFile', {
        describe: '入力ファイル（CSVファイルまたは"-"で標準入力）',
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
        describe: '出力ファイル（省略時は標準出力）',
        type: 'string',
        default: undefined,
      });
  },

  handler: async (argv: ArgumentsCamelCase<ReverseGeocodeCommandArgv>): Promise<void> => {
    const inputFile = argv.inputFile;
    const outputFile = argv.outputFile;
    
    // 単発実行かファイル入力かを判定
    if (!inputFile && (argv.lat !== undefined && argv.lon !== undefined)) {
      // 単発実行モード
      await handleSingleCoordinate(argv);
    } else if (inputFile) {
      // ファイル入力モード
      await handleFileInput(argv);
    } else {
      console.error('使用方法:');
      console.error('  単発実行: abrg reverse --lat 35.679 --lon 139.736');
      console.error('  ファイル処理: abrg reverse coordinates.csv [output.json]');
      console.error('  標準入力: abrg reverse -');
      process.exit(1);
    }
  },
};

// 単発実行処理
async function handleSingleCoordinate(argv: ArgumentsCamelCase<ReverseGeocodeCommandArgv>): Promise<void> {
  const lat = argv.lat!;
  const lon = argv.lon!;
  const limit = argv.limit || 1;
  const searchTarget = (argv.target || SearchTarget.ALL) as SearchTarget;
  const format = (argv.format || OutputFormat.GEOJSON) as OutputFormat;
  const debug = argv.debug === true;
  const silent = argv.silent === true;
  const abrgDir = resolveHome(argv.abrgDir || EnvProvider.DEFAULT_ABRG_DIR);
  
  // 検索手法の決定
  const useSpatialIndex = argv.haversine ? false : (argv.spatialIndex ?? true);
  const methodName = useSpatialIndex ? 'R木空間インデックス（高速）' : 'ハヴァーサイン公式';

  if (!silent) {
    console.error(`逆ジオコーディング実行: 座標(${lat}, ${lon}) [${methodName}]`);
  }

  if (debug) {
    console.time("reverse-geocoding");
  }

  const rootDir = upwardFileSearch(__dirname, 'build');
  if (!rootDir) {
    throw new AbrgError({
      messageId: AbrgMessage.CANNOT_FIND_THE_ROOT_DIR,
      level: AbrgErrorLevel.ERROR,
    });
  }

  const container = new AbrGeocoderDiContainer({
    database: {
      type: 'sqlite3',
      dataDir: path.join(abrgDir, 'database'),
    },
    debug,
    cacheDir: path.join(abrgDir, 'cache'),
  });

  const geocoder = await AbrGeocoder.create({
    container,
    numOfThreads: 1,
    isSilentMode: silent,
    useSpatialIndex,
  });

  let results: any[] = [];

  try {
    results = await geocoder.reverseGeocode({
      lat,
      lon,
      limit,
      searchTarget,
      useSpatialIndex,
    });

    if (format === OutputFormat.GEOJSON) {
      const geoJsonResponse = {
        type: "FeatureCollection",
        query: {
          lat,
          lon,
          limit,
          target: searchTarget,
        },
        result_info: {
          count: results.length,
          limit,
          api_version: "3.0.0",
          db_version: await geocoder.getDbVersion(),
        },
        features: results.map(result => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [parseFloat(result.rep_lon!), parseFloat(result.rep_lat!)],
          },
          properties: {
            formatted_address: result.formatted.address,
            match_level: result.match_level.str,
            distance: result.distance,
            ids: {
              lg_code: result.lg_code || null,
              machiaza_id: result.machiaza_id || null,
              rsdt_addr_flg: result.rsdt_addr_flg ?? null,
              blk_id: result.block_id || null,
              rsdt_id: result.rsdt_id || null,
              rsdt2_id: result.rsdt2_id || null,
              prc_id: result.prc_id || null,
            },
            structured_address: {
              pref: result.pref || null,
              county: result.county || null,
              city: result.city || null,
              ward: result.ward || null,
              oaza_cho: result.oaza_cho || null,
              chome: result.chome || null,
              koaza: result.koaza || null,
              blk_num: result.block || null,
              rsdt_num: result.rsdt_num?.toString() || null,
              rsdt_num2: result.rsdt2_id?.toString() || null,
              prc_num1: result.prc_num1 || null,
              prc_num2: result.prc_num2 || null,
              prc_num3: result.prc_num3 || null,
            },
          },
        })),
      };
      console.log(JSON.stringify(geoJsonResponse, null, 2));
    } else {
      const formatter = FormatterProvider.get({
        type: format,
        debug,
      });
      
      const cleanResults = results.map(result => 
        geocoder.convertReverseResultToQueryCompatible(result)
      );
      
      cleanResults.forEach(result => {
        formatter.write(result);
      });
      formatter.end();
      
      formatter.pipe(process.stdout);
    }

  } finally {
    await geocoder.close();
  }

  if (debug) {
    console.timeEnd("reverse-geocoding");
  }

  if (!silent) {
    console.error(`逆ジオコーディング完了: ${results.length}件の結果`);
  }
}

// ファイル入力処理
async function handleFileInput(argv: ArgumentsCamelCase<ReverseGeocodeCommandArgv>): Promise<void> {
  const source = argv.inputFile!;
  const destination = argv.outputFile;
  const limit = argv.limit || 1;
  const searchTarget = (argv.target || SearchTarget.ALL) as SearchTarget;
  const format = (argv.format || OutputFormat.JSON) as OutputFormat;
  const debug = argv.debug === true;
  const abrgDir = resolveHome(argv.abrgDir || EnvProvider.DEFAULT_ABRG_DIR);
  const useSpatialIndex = argv.haversine ? false : (argv.spatialIndex ?? true);

  if (debug) {
    console.time("reverse-geocoding");
  }

  const isSilentMode = argv.silent || destination === '-' || destination === undefined;
  const srcStream = getReadStreamFromSource(source);
  const formatter = FormatterProvider.get({
    type: format,
    debug,
  });

  const outputStream: Writable = (destination => {
    if (destination === '' || destination === undefined) {
      process.stdout.setMaxListeners(0);
      return process.stdout;
    }

    const result = fs.createWriteStream(path.normalize(destination), {
      encoding: 'utf8',
      highWaterMark: 64 * 1024 * 1024,
    });
    return result;
  })(destination);

  const rootDir = upwardFileSearch(__dirname, 'build');
  if (!rootDir) {
    throw new AbrgError({
      messageId: AbrgMessage.CANNOT_FIND_THE_ROOT_DIR,
      level: AbrgErrorLevel.ERROR,
    });
  }

  const container = new AbrGeocoderDiContainer({
    database: {
      type: 'sqlite3',
      dataDir: path.join(abrgDir, 'database'),
    },
    debug,
    cacheDir: path.join(abrgDir, 'cache'),
  });

  const numOfThreads = 1;
  
  const cacheProgressBar = isSilentMode ? undefined : createSingleProgressBar(CACHE_CREATE_PROGRESS_BAR);
  cacheProgressBar?.start(1, 0);
  const createCacheTask = Promise.resolve();

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
  ]);

  cacheProgressBar?.stop();

  const geocoder = await AbrGeocoder.create({
    container,
    numOfThreads: numOfLinesInFiles < numOfThreads ? numOfLinesInFiles : numOfThreads,
    isSilentMode,
    useSpatialIndex,
  });

  const reverseGeocoderStream = new AbrReverseGeocoderStream({
    geocoder,
    searchTarget,
    limit,
    useSpatialIndex,
    highWatermark: numOfThreads * 500,
  });

  const geocodeProgressBar = isSilentMode ? undefined : createSingleProgressBar(GEOCODING_PROGRESS_BAR);
  geocodeProgressBar?.start(numOfLinesInFiles, 0);

  const streamCounter = new StreamCounter({
    fps: 10,
    callback(current) {
      geocodeProgressBar?.update(current);
    },
  });

  const lineByLine = new LineByLineTransform();
  const coordinateParsing = new CoordinateParsingTransform();
  
  const onPause = () => {
    return !srcStream.isPaused() && srcStream.pause();
  };
  const onResume = () => {
    return srcStream.isPaused() && srcStream.resume();
  };
  reverseGeocoderStream.on('pause', onPause);
  reverseGeocoderStream.on('resume', onResume);
   
  await streamPromises.pipeline(
    srcStream,
    lineByLine,
    coordinateParsing,
    reverseGeocoderStream,
    streamCounter,
    formatter,
    outputStream,
  );

  geocoder.close();
  geocodeProgressBar?.stop();
  
  if (debug) {
    console.timeEnd("reverse-geocoding");
  }
}

export default reverseGeocodeCommand;
