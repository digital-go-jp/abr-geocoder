#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const commander_1 = require("commander");
const byline_1 = __importDefault(require("byline"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const downloader_1 = require("./downloader");
const config_1 = require("./config");
const normalizer_1 = require("./normalizer");
const formatting_1 = require("./engine/formatting");
const packageJsonPath = node_path_1.default.join(__dirname, '../package.json');
const { description, version } = JSON.parse(node_fs_1.default.readFileSync(packageJsonPath, 'utf8'));
commander_1.program.name('abr-geocoder')
    .description(description)
    .version(version);
const FORMATTERS = {
    'json': (r) => r,
    'geojson': (r) => ({
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [r.lon, r.lat]
        },
        properties: {
            title: `${r.pref}${r.city}${r.town}${(0, formatting_1.formatResidentialSection)(r)}`,
            level: r.level,
            pref: r.pref,
            city: r.city,
            lg_code: r.lg_code,
            town: r.town,
            town_id: r.town_id,
            blk: r.blk,
            blk_id: r.blk_id,
            addr1: r.addr1,
            addr1_id: r.addr1_id,
            addr2: r.addr2,
            addr2_id: r.addr2_id,
            other: r.other,
        }
    }),
};
commander_1.program
    .command('download')
    .description('アドレス・ベース・レジストリの最新データをCKANからダウンロードする')
    .option('-d|--data <dataPath>', 'アドレス・ベース・レジストリのデータを格納するディレクトリを指定する。指定されていない場合はデフォルトのディレクトリを参照します。')
    .option('-s|--source <sourceId>', 'アドレス・ベース・レジストリのデータソースID。全国データは `ba000001` をお使いください。', 'ba000001')
    .action(async (options) => {
    console.log('download開始。。');
    const dataDir = await (0, config_1.getDataDir)(options.data);
    await (0, downloader_1.loadDataset)(options.source, dataDir);
});
commander_1.program
    .command('update-check')
    .description('アドレス・ベース・レジストリのデータが最新であることを確認します')
    .option('-d|--data <dataPath>', 'アドレス・ベース・レジストリのデータを格納するディレクトリを指定する。指定されていない場合はデフォルトのディレクトリを参照します。')
    .option('-s|--source <sourceId>', 'アドレス・ベース・レジストリのデータソースID。全国データは `ba000001` をお使いください。', 'ba000001')
    .action(async (options) => {
    const dataDir = await (0, config_1.getDataDir)(options.data);
    const { updateAvailable } = await (0, downloader_1.checkForUpdates)(options.source, dataDir);
    if (updateAvailable) {
        console.error('ローカルのデータが更新できます。 abr-geocoder download で更新してください。');
        process.exit(1);
    }
    console.error('ローカルのデータは最新です。');
});
commander_1.program
    .command('normalize <inputFile>')
    .description('入力されたアドレスをジオコーディングする。 <inputFile> にアドレスが改行で分けられたファイルを指定してください。標準入力で渡したい場合は、 `-` を指定してください。')
    .option('--fuzzy', 'このオプションが有効化されている場合は、「?」を1文字ワイルドカードとして認識されます。', false)
    .option('-d|--data <dataPath>', 'アドレス・ベース・レジストリのデータを格納するディレクトリを指定する。指定されていない場合はデフォルトのディレクトリを参照します。')
    .option('-s|--source <sourceId>', 'アドレス・ベース・レジストリのデータソースID。全国データは `ba000001` をお使いください。', 'ba000001')
    .option('-f|--format <outputFormat>', '出力フォーマットを指定する。デフォルトは `table`。対応オプション: table, ndjson, json, ndgeojson, geojson', 'table')
    .action(async (filepath, options) => {
    let inputStream;
    if (filepath === "-") {
        // read from stdin
        inputStream = process.stdin;
    }
    else {
        if (!node_fs_1.default.existsSync(filepath)) {
            commander_1.program.error(`入力のファイル ${filepath} が見つかりませんでした。標準入力から入力したい場合は、 - を入力ファイルとして指定してください。`);
        }
        inputStream = node_fs_1.default.createReadStream(filepath);
    }
    const lines = byline_1.default.createStream();
    inputStream.pipe(lines);
    const dataDir = await (0, config_1.getDataDir)(options.data);
    const sourceId = options.source;
    const g = new normalizer_1.Normalize(dataDir, sourceId);
    const allResults = [];
    for await (const lineBuf of lines) {
        const line = lineBuf.toString();
        if (line.startsWith('#'))
            continue;
        const r = await g.normalizeAddress(line, { fuzzy: options.fuzzy });
        if (!options.format.startsWith('nd')) {
            allResults.push(r);
        }
        else if (options.format === 'ndjson') {
            console.log(JSON.stringify(FORMATTERS.json(r)));
        }
        else if (options.format === 'ndgeojson') {
            console.log(JSON.stringify(FORMATTERS.geojson(r)));
        }
    }
    if (options.format === 'table') {
        const table = new cli_table3_1.default({
            head: ['マッチングレベル', '都道府県', '市区町村', '町字', '街区符号', '住居番号', '以降', '緯度', '経度']
        });
        for (const r of allResults) {
            table.push([
                r.level,
                r.pref,
                r.city + (r.lg_code ? ` (${r.lg_code})` : ''),
                r.town + (r.town_id ? ` (${r.town_id})` : ''),
                (r.blk || '') + (r.blk_id ? ` (${r.blk_id})` : ''),
                (0, formatting_1.formatResidentialSection)({ addr1: r.addr1, addr2: r.addr2 }) + (r.addr1_id || r.addr2_id ? ` (${(0, formatting_1.formatResidentialSection)({ addr1: r.addr1_id, addr2: r.addr2_id })})` : ''),
                r.other,
                r.lat,
                r.lon,
            ]);
        }
        console.log(table.toString());
    }
    else if (options.format === 'json') {
        console.log(JSON.stringify(allResults.map(FORMATTERS.json)));
    }
    else if (options.format === 'geojson') {
        console.log(JSON.stringify({
            "type": "FeatureCollection",
            "features": allResults.map(FORMATTERS.geojson),
        }));
    }
});
commander_1.program.parse();
