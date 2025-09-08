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
import { EnvProvider } from '@domain/models/env-provider';
import { resolveHome } from '@domain/services/resolve-home';
import { upwardFileSearch } from '@domain/services/upward-file-search';
import { AbrgError, AbrgErrorLevel } from '@domain/types/messages/abrg-error';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import { OutputFormat } from '@domain/types/output-format';
import { SearchTarget } from '@domain/types/search-target';
import { FormatterProvider } from '@interface/format/formatter-provider';
import { AbrGeocoder } from '@usecases/geocode/abr-geocoder';
import { AbrGeocoderDiContainer } from '@usecases/geocode/models/abr-geocoder-di-container';
import { createGeocodeCaches } from '@usecases/geocode/services/create-geocode-caches';
import path from 'node:path';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';

export type ReverseGeocodeCommandArgv = {
  reverse?: boolean; // 'reverse' または 'r' は必須
  r?: boolean; // alias 'r' も必須

  abrgDir?: string; // 'abrgDir' または 'd' はオプショナル
  d?: string; // alias 'd' もオプショナル

  lat: number; // 'lat' は必須
  lon: number; // 'lon' は必須

  limit?: number; // 'limit' または 'l' はオプショナル
  l?: number; // alias 'l' もオプショナル

  target?: SearchTarget; // 'target' または 't' はオプショナル
  t?: SearchTarget; // alias 't' もオプショナル

  format?: OutputFormat; // 'format' または 'f' はオプショナル
  f?: OutputFormat; // alias 'f' もオプショナル

  debug?: boolean; // 'debug' はオプショナル
  silent?: boolean; // 'silent' はオプショナル
};

/**
 * abrg --reverse
 * 座標から住所を取得する逆ジオコーディング機能
 */
const reverseGeocodeCommand: CommandModule<{}, ReverseGeocodeCommandArgv> = {
  command: 'reverse',
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
        describe: '緯度（十進度数、-90から90まで）',
        demandOption: true,
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
        describe: '経度（十進度数、-180から180まで）',
        demandOption: true,
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
          OutputFormat.GEOJSON,
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
      });
  },

  handler: async (argv: ArgumentsCamelCase<ReverseGeocodeCommandArgv>): Promise<void> => {
    const lat = argv.lat;
    const lon = argv.lon;
    const limit = argv.limit || 1;
    const searchTarget = (argv.target || SearchTarget.ALL) as SearchTarget;
    const format = (argv.format || OutputFormat.GEOJSON) as OutputFormat;
    const debug = argv.debug === true;
    const silent = argv.silent === true;
    const abrgDir = resolveHome(argv.abrgDir || EnvProvider.DEFAULT_ABRG_DIR);

    if (!silent) {
      console.error(`逆ジオコーディング実行: 座標(${lat}, ${lon})`);
    }

    // 逆ジオコーディングにかかる時間を表示
    if (debug) {
      console.time("reverse-geocoding");
    }

    // ルートディレクトリを探す
    const rootDir = upwardFileSearch(__dirname, 'build');
    if (!rootDir) {
      throw new AbrgError({
        messageId: AbrgMessage.CANNOT_FIND_THE_ROOT_DIR,
        level: AbrgErrorLevel.ERROR,
      });
    }

    // DIコンテナをセットアップする
    const container = new AbrGeocoderDiContainer({
      database: {
        type: 'sqlite3',
        dataDir: path.join(abrgDir, 'database'),
      },
      debug,
      cacheDir: path.join(abrgDir, 'cache'),
    });

    // キャッシュデータの作成
    await createGeocodeCaches({
      container,
      maxConcurrency: 1,
      progress: debug ? (current: number, total: number) => {
        console.error(`キャッシュ作成中: ${current}/${total}`);
      } : undefined,
    });

    // ジオコーダの作成
    const geocoder = await AbrGeocoder.create({
      container,
      numOfThreads: 1,
      isSilentMode: silent,
    });

    let results: any[] = [];

    try {
      // 逆ジオコーディングを実行
      results = await geocoder.reverseGeocode({
        lat,
        lon,
        limit,
        searchTarget,
      });

      if (format === OutputFormat.GEOJSON) {
        // GeoJSON形式でのレスポンス（APIと同様）
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
        // 通常のジオコーディング結果をクリーンアップしてフォーマット
        const formatter = FormatterProvider.get({
          type: format,
          debug,
        });
        
        // ReverseGeocodeResult -> FormatterProvider互換形式に変換
        const cleanResults = results.map(result => 
          geocoder.convertReverseResultToQueryCompatible(result)
        );
        
        // 各結果を順番に出力
        cleanResults.forEach(result => {
          formatter.write(result);
        });
        formatter.end();
        
        // formatter の出力を stdout に書き込む
        formatter.pipe(process.stdout);
      }

    } finally {
      await geocoder.close();
    }

    // 逆ジオコーディングにかかる時間を表示
    if (debug) {
      console.timeEnd("reverse-geocoding");
    }

    if (!silent) {
      console.error(`逆ジオコーディング完了: ${results.length}件の結果`);
    }
  },
};

export default reverseGeocodeCommand;