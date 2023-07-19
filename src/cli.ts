#!/usr/bin/env node

import path from 'node:path';
import fs from 'node:fs';

import {program} from 'commander';

import byline from 'byline';
import Table from "cli-table3";
import { checkForUpdates, loadDataset } from './downloader';
import { getDataDir } from './config';
import { Normalize } from './normalizer';
import { NormalizeResult } from './engine/normalize';
import { formatResidentialSection } from './engine/formatting';
import * as Formatters from './formatters';

const packageJsonPath = path.join(__dirname, '../package.json');
const {description, version} = JSON.parse(
  fs.readFileSync(packageJsonPath, 'utf8')
);

program.name('abr-geocoder').description(description).version(version);

type DownloadPgmOpts = {
  data: string | undefined;
  source: string;
};

program
  .command('download')
  .description(
    'アドレス・ベース・レジストリの最新データをCKANからダウンロードする'
  )
  .option(
    '-d|--data <dataPath>',
    'アドレス・ベース・レジストリのデータを格納するディレクトリを指定する。指定されていない場合はデフォルトのディレクトリを参照します。'
  )
  .option(
    '-s|--source <sourceId>',
    'アドレス・ベース・レジストリのデータソースID。全国データは `ba000001` をお使いください。',
    'ba000001'
  )
  .action(async (options: DownloadPgmOpts) => {
    console.log('download開始。。');
    const dataDir = await getDataDir(options.data);
    await loadDataset(options.source, dataDir);
  });

program
  .command('update-check')
  .description(
    'アドレス・ベース・レジストリのデータが最新であることを確認します'
  )
  .option(
    '-d|--data <dataPath>',
    'アドレス・ベース・レジストリのデータを格納するディレクトリを指定する。指定されていない場合はデフォルトのディレクトリを参照します。'
  )
  .option(
    '-s|--source <sourceId>',
    'アドレス・ベース・レジストリのデータソースID。全国データは `ba000001` をお使いください。',
    'ba000001'
  )
  .action(async (options: DownloadPgmOpts) => {
    const dataDir = await getDataDir(options.data);
    const {updateAvailable} = await checkForUpdates(options.source, dataDir);
    if (updateAvailable) {
      console.error(
        'ローカルのデータが更新できます。 abr-geocoder download で更新してください。'
      );

      // TODO: 不要な形に書き換える
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }

    console.error('ローカルのデータは最新です。');
  });

type NormalizePgmOpts = {
  data: string | undefined;
  source: string;
  format: string;
  fuzzy: boolean;
};

program
  .command('normalize <inputFile>')
  .description(
    '入力されたアドレスをジオコーディングする。 <inputFile> にアドレスが改行で分けられたファイルを指定してください。標準入力で渡したい場合は、 `-` を指定してください。'
  )
  .option(
    '--fuzzy',
    'このオプションが有効化されている場合は、「?」を1文字ワイルドカードとして認識されます。',
    false
  )
  .option(
    '-d|--data <dataPath>',
    'アドレス・ベース・レジストリのデータを格納するディレクトリを指定する。指定されていない場合はデフォルトのディレクトリを参照します。'
  )
  .option(
    '-s|--source <sourceId>',
    'アドレス・ベース・レジストリのデータソースID。全国データは `ba000001` をお使いください。',
    'ba000001'
  )
  .option(
    '-f|--format <outputFormat>',
    '出力フォーマットを指定する。デフォルトは `table`。対応オプション: table, ndjson, json, ndgeojson, geojson',
    'table'
  )
  .action(async (filepath: string, options: NormalizePgmOpts) => {
    let inputStream: NodeJS.ReadStream | fs.ReadStream;
    if (filepath === '-') {
      // read from stdin
      inputStream = process.stdin;
    } else {
      if (!fs.existsSync(filepath)) {
        program.error(
          `入力のファイル ${filepath} が見つかりませんでした。標準入力から入力したい場合は、 - を入力ファイルとして指定してください。`
        );
      }
      inputStream = fs.createReadStream(filepath);
    }

    const lines = byline.createStream();
    inputStream.pipe(lines);

    const dataDir = await getDataDir(options.data);
    const sourceId = options.source;

    const g = new Normalize(dataDir, sourceId);

    const allResults: NormalizeResult[] = [];
    for await (const lineBuf of lines) {
      const line: string = lineBuf.toString();
      if (line.startsWith('#')) continue;
      const r = await g.normalizeAddress(line, {fuzzy: options.fuzzy});
      if (!options.format.startsWith('nd')) {
        allResults.push(r);
      } else if (options.format === 'ndjson') {
        console.log(JSON.stringify(Formatters.json(r)));
      } else if (options.format === 'ndgeojson') {
        console.log(JSON.stringify(Formatters.geoJson(r)));
      }
    }

    if (options.format === 'table') {
      const table = new Table({
        head: [
          'マッチングレベル',
          '都道府県',
          '市区町村',
          '町字',
          '街区符号',
          '住居番号',
          '以降',
          '緯度',
          '経度',
        ],
      });
      for (const r of allResults) {
        table.push([
          r.level,
          r.pref,
          r.city + (r.lg_code ? ` (${r.lg_code})` : ''),
          r.town + (r.town_id ? ` (${r.town_id})` : ''),
          (r.blk || '') + (r.blk_id ? ` (${r.blk_id})` : ''),
          formatResidentialSection({addr1: r.addr1, addr2: r.addr2}) +
            (r.addr1_id || r.addr2_id
              ? ` (${formatResidentialSection({
                  addr1: r.addr1_id,
                  addr2: r.addr2_id,
                })})`
              : ''),
          r.other,
          r.lat,
          r.lon,
        ]);
      }
      console.log(table.toString());
    } else if (options.format === 'json') {
      console.log(
        JSON.stringify(allResults.map(Formatters.json)),
      );
    } else if (options.format === 'geojson') {
      console.log(
        JSON.stringify({
          "type": "FeatureCollection",
          "features": allResults.map(Formatters.geoJson),
        }),
      );
    }
  });

program.parse();
