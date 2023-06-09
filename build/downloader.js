"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDataset = exports.checkForUpdates = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const csv_parse_1 = __importDefault(require("csv-parse"));
const node_stream_zip_1 = __importDefault(require("node-stream-zip"));
const undici_1 = require("undici");
const pretty_bytes_1 = __importDefault(require("pretty-bytes"));
const cli_progress_1 = __importDefault(require("cli-progress"));
const ckan_1 = require("./ckan");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const utils_1 = require("./utils");
const proj4_1 = __importDefault(require("proj4"));
proj4_1.default.defs("EPSG:4612", "+proj=longlat +ellps=GRS80 +no_defs +type=crs");
proj4_1.default.defs("EPSG:6668", "+proj=longlat +ellps=GRS80 +no_defs +type=crs");
// const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36';
const USER_AGENT = 'curl/7.81.0';
async function checkForUpdates(ckanId, dataDir) {
    const sqliteArchivePath = node_path_1.default.join(dataDir, `${ckanId}.sqlite`);
    const upstreamMeta = await getDatasetMetadata(ckanId);
    const currentArchiveMeta = await getArchiveMetadata(sqliteArchivePath);
    // we'll test to see if the modified date we have in our archive is earlier
    // than the newest modified date in the archive.
    const updateAvailable = typeof currentArchiveMeta?.last_modified !== 'undefined' ?
        currentArchiveMeta.last_modified < upstreamMeta.lastModified
        :
            true;
    return {
        updateAvailable,
        upstreamMeta,
        localFile: sqliteArchivePath,
    };
}
exports.checkForUpdates = checkForUpdates;
async function loadDataset(ckanId, dataDir) {
    const { updateAvailable, upstreamMeta, localFile, } = await checkForUpdates(ckanId, dataDir);
    if (!updateAvailable) {
        console.log(`現状データが最新です。更新を中断します。`);
        return;
    }
    const outZip = node_path_1.default.join(dataDir, `${ckanId}.zip`);
    await downloadDataset(upstreamMeta, outZip);
    // keep the main archive for later usage
    const unzippedDir = await unzipArchive(outZip);
    await createSqliteArchive(upstreamMeta, unzippedDir, localFile);
    await node_fs_1.default.promises.rm(unzippedDir, { recursive: true });
}
exports.loadDataset = loadDataset;
async function getArchiveMetadata(archive) {
    if (!node_fs_1.default.existsSync(archive)) {
        return undefined;
    }
    const db = new better_sqlite3_1.default(archive);
    const allMetadata = db.prepare('SELECT "key", "value" FROM "metadata"').all();
    const out = {};
    for (const row of allMetadata) {
        out[row.key] = row.value;
    }
    return out;
}
async function getDatasetMetadata(ckanId) {
    const metaResp = await (0, undici_1.fetch)(`${ckan_1.CKAN_BASE_REGISTRY_URL}/api/3/action/package_show?id=${ckanId}`, {
        headers: {
            'user-agent': USER_AGENT,
        },
    });
    if (!metaResp.ok) {
        const body = await metaResp.text();
        console.error(`Body: ${body}`);
        throw new Error(`${ckanId} を読み込むときに失敗しました。もう一度お試してください。 (HTTP: ${metaResp.status} ${metaResp.statusText})`);
    }
    const metaWrapper = await metaResp.json();
    if (metaWrapper.success === false) {
        throw new Error(`${ckanId} を読み込むときに失敗しました。もう一度お試してください。`);
    }
    const meta = metaWrapper.result;
    const csvResource = meta.resources.find((x) => x.format.toLowerCase().startsWith('csv'));
    if (!csvResource) {
        throw new Error(`${ckanId} に該当のCSVリソースが見つかりませんでした。ご確認ください: ${ckan_1.CKAN_BASE_REGISTRY_URL}/dataset/${ckanId}`);
    }
    return {
        fileUrl: csvResource.url,
        lastModified: csvResource.last_modified,
    };
}
async function downloadDataset(meta, outputFile) {
    // perform the download
    console.log(`ダウンロード開始: ${meta.fileUrl} → ${outputFile}`);
    const progress = new cli_progress_1.default.SingleBar({
        format: ' {bar} {percentage}% | ETA: {eta_formatted} | {value}/{total}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        etaBuffer: 30,
        fps: 2,
        formatValue: (v, options, type) => {
            if (type === 'value' || type === 'total') {
                return (0, pretty_bytes_1.default)(v);
            }
            // no autopadding ? passthrough
            if (options.autopadding !== true) {
                return v.toString();
            }
            // padding
            function autopadding(value, length) {
                return ((options.autopaddingChar || " ") + value).slice(-length);
            }
            switch (type) {
                case 'percentage':
                    return autopadding(v, 3);
                default:
                    return v.toString();
            }
        }
    });
    const resp = await (0, undici_1.request)(meta.fileUrl, {
        method: 'GET',
        headers: {
            'user-agent': USER_AGENT,
        },
    });
    await new Promise((resolve, _reject) => {
        const outputStream = node_fs_1.default.createWriteStream(outputFile);
        const filteredRawHeaders = Object.fromEntries(Object.entries(resp.headers)
            .filter(([_key, value]) => typeof value !== 'undefined'));
        const headers = new undici_1.Headers(filteredRawHeaders);
        const contentLength = headers.get('content-length') || '-1';
        progress.start(parseInt(contentLength, 10), 0);
        resp.body.on('data', (chunk) => {
            progress.increment(chunk.length);
        });
        resp.body.on('end', () => {
            progress.stop();
            resolve();
        });
        resp.body.pipe(outputStream);
    });
}
async function unzipArchive(archivePath) {
    const outputPath = node_path_1.default.join(node_path_1.default.dirname(archivePath), node_path_1.default.basename(archivePath, '.zip'));
    if (node_fs_1.default.existsSync(outputPath)) {
        return outputPath;
    }
    const zip = new node_stream_zip_1.default.async({ file: archivePath });
    const entries = await zip.entries();
    const entriesAry = Object.values(entries);
    if (entriesAry.length === 1 && entriesAry[0].name.toLowerCase().endsWith('.csv')) {
        // we will use this zip file directly, so we don't need to decompress it.
        await zip.close();
        return archivePath;
    }
    const subExtracts = [];
    zip.on('extract', (entry, file) => {
        if (entry.name.toLowerCase().endsWith('.zip')) {
            // extract this file too
            // we don't need the intermediate zip archives
            subExtracts.push(unzipArchive(file));
        }
    });
    await node_fs_1.default.promises.mkdir(outputPath, { recursive: true });
    await zip.extract(null, outputPath);
    await Promise.all(subExtracts);
    await zip.close();
    await node_fs_1.default.promises.rm(archivePath);
    return outputPath;
}
function parseFilename(filename) {
    const fileMatch = filename.match(/^mt_(city|pref|(?:town|rsdtdsp_(?:rsdt|blk))(?:_pos)?)_(all|pref\d{2})/);
    if (!fileMatch) {
        return undefined;
    }
    const type = fileMatch[1];
    const fileArea = fileMatch[2];
    return { type, fileArea };
}
async function createSqliteArchive(meta, inputDir, outputPath) {
    const db = new better_sqlite3_1.default(outputPath);
    const schemaPath = node_path_1.default.join(__dirname, '../schema.sql');
    // We use these dangerous settings to improve performance, because if data is corrupted,
    // we can always just regenerate the database.
    db.exec(`PRAGMA journal_mode = MEMORY;`);
    db.exec(`PRAGMA synchronous = OFF;`);
    db.exec(await node_fs_1.default.promises.readFile(schemaPath, 'utf8'));
    const metaStmt = db.prepare('INSERT OR REPLACE INTO "metadata" ("key", "value") VALUES (?, ?)');
    const settings = {
        'pref': {
            indexCols: 1,
            validDateCol: 4,
            stmt: db.prepare('INSERT OR REPLACE INTO "pref" ("code", "都道府県名", "都道府県名_カナ", "都道府県名_英字", "効力発生日", "廃止日", "備考") VALUES (?, ?, ?, ?, ?, ?, ?)'),
        },
        'city': {
            indexCols: 1,
            validDateCol: 14,
            stmt: db.prepare('INSERT OR REPLACE INTO "city" ("code", "都道府県名", "都道府県名_カナ", "都道府県名_英字", "郡名", "郡名_カナ", "郡名_英字", "市区町村名", "市区町村名_カナ", "市区町村名_英字", "政令市区名", "政令市区名_カナ", "政令市区名_英字", "効力発生日", "廃止日", "備考") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
        },
        'town': {
            indexCols: 2,
            validDateCol: 32,
            stmt: db.prepare('INSERT OR REPLACE INTO "town" ("code", "town_id", "町字区分コード", "都道府県名", "都道府県名_カナ", "都道府県名_英字", "郡名", "郡名_カナ", "郡名_英字", "市区町村名", "市区町村名_カナ", "市区町村名_英字", "政令市区名", "政令市区名_カナ", "政令市区名_英字", "大字・町名", "大字・町名_カナ", "大字・町名_英字", "丁目名", "丁目名_カナ", "丁目名_数字", "小字名", "小字名_カナ", "小字名_英字", "住居表示フラグ", "住居表示方式コード", "大字・町名_通称フラグ", "小字名_通称フラグ", "大字・町名_電子国土基本図外字", "小字名_電子国土基本図外字", "状態フラグ", "起番フラグ", "効力発生日", "廃止日", "原典資料コード", "郵便番号", "備考") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
        },
        'rsdtdsp_blk': {
            indexCols: 3,
            validDateCol: 14,
            stmt: db.prepare('INSERT OR REPLACE INTO "rsdtdsp_blk" ("code", "town_id", "blk_id", "市区町村名", "政令市区名", "大字・町名", "丁目名", "小字名", "街区符号", "住居表示フラグ", "住居表示方式コード", "大字・町名_電子国土基本図外字", "小字名_電子国土基本図外字", "状態フラグ", "効力発生日", "廃止日", "原典資料コード", "備考") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
        },
        'rsdtdsp_rsdt': {
            indexCols: 5,
            validDateCol: 19,
            stmt: db.prepare('INSERT OR REPLACE INTO "rsdtdsp_rsdt" ("code", "town_id", "blk_id", "addr_id", "addr2_id", "市区町村名", "政令市区名", "大字・町名", "丁目名", "小字名", "街区符号", "住居番号", "住居番号2", "基礎番号・住居番号区分", "住居表示フラグ", "住居表示方式コード", "大字・町名_電子国土基本図外字", "小字名_電子国土基本図外字", "状態フラグ", "効力発生日", "廃止日", "原典資料コード", "備考") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
        },
    };
    const posUpdateSettings = {
        'town_pos': {
            indexCols: 2,
            stmt: db.prepare('UPDATE "town" SET "代表点_経度" = ?, "代表点_緯度" = ? WHERE "code" = ? AND "town_id" = ?'),
        },
        'rsdtdsp_blk_pos': {
            indexCols: 3,
            stmt: db.prepare('UPDATE "rsdtdsp_blk" SET "代表点_経度" = ?, "代表点_緯度" = ? WHERE "code" = ? AND "town_id" = ? AND "blk_id" = ?'),
        },
        'rsdtdsp_rsdt_pos': {
            indexCols: 5,
            stmt: db.prepare('UPDATE "rsdtdsp_rsdt" SET "代表点_経度" = ?, "代表点_緯度" = ? WHERE "code" = ? AND "town_id" = ? AND "blk_id" = ? AND "addr_id" = ? AND "addr2_id" = ?'),
        },
    };
    console.time(`sqlite`);
    for await (const p of (0, utils_1.walkDir)(inputDir)) {
        const filename = node_path_1.default.basename(p);
        const parsedFilename = parseFilename(filename);
        if (!parsedFilename) {
            continue;
        }
        const { type, fileArea } = parsedFilename;
        const usePos = type.endsWith('_pos');
        if (usePos) {
            continue;
        }
        const config = settings[type];
        if (!config) {
            continue;
        }
        const { indexCols, validDateCol, stmt } = config;
        console.timeLog(`sqlite`, `${type} (${fileArea}) 読み込み中...`);
        const zip = new node_stream_zip_1.default.async({ file: p });
        const entries = await zip.entries();
        const entriesAry = Object.values(entries);
        const inputStream = await zip.stream(entriesAry[0]);
        const parser = inputStream.pipe(csv_parse_1.default.parse({
            encoding: 'utf-8',
            from: 2,
        }));
        const rows = [];
        let allRowCount = 0;
        let prevIndexKey;
        let prevValidDate;
        for await (const line of parser) {
            allRowCount += 1;
            const indexKey = [
                ...line.slice(0, indexCols),
            ].join('|');
            const newRow = line;
            if (prevIndexKey === indexKey) {
                if (prevValidDate && prevValidDate < newRow[validDateCol]) {
                    // because the last entry of the rows array is older than the one we are about to insert, we
                    // will pop it off and replace it with the newRow
                    rows.pop();
                }
                else {
                    // because the last entry of the rows array is newer than the one we are about to insert, we
                    // will skip this one because the one in the array is already valid.
                    continue;
                }
            }
            rows.push(newRow);
            prevIndexKey = indexKey;
            prevValidDate = newRow[validDateCol];
        }
        console.timeLog(`sqlite`, `${type} (${fileArea}) 読み込み完了。入力行数: ${allRowCount}, 格納行数: ${rows.length}`);
        db.transaction(() => {
            for (const row of rows) {
                try {
                    stmt.run(row);
                }
                catch (e) {
                    console.error('error in row', row, e);
                    throw e;
                }
            }
        })();
        console.timeLog(`sqlite`, `${type} (${fileArea}) 格納完了`);
        await node_fs_1.default.promises.rm(p);
    }
    // we run the pos files afterwards, because we need the initial data from the regular CSV files first
    for await (const p of (0, utils_1.walkDir)(inputDir)) {
        const filename = node_path_1.default.basename(p);
        const parsedFilename = parseFilename(filename);
        if (!parsedFilename) {
            continue;
        }
        const { type, fileArea } = parsedFilename;
        const usePos = type.endsWith('_pos');
        if (!usePos) {
            continue;
        }
        const config = posUpdateSettings[type];
        if (!config) {
            continue;
        }
        const { indexCols, stmt } = config;
        console.timeLog(`sqlite`, `[位置参照] ${type} (${fileArea}) 読み込み中...`);
        const zip = new node_stream_zip_1.default.async({ file: p });
        const entries = await zip.entries();
        const entriesAry = Object.values(entries);
        const inputStream = await zip.stream(entriesAry[0]);
        const parser = inputStream.pipe(csv_parse_1.default.parse({
            encoding: 'utf-8',
            from: 1,
            quote: false,
            relax_quotes: true,
        }));
        let index = 0;
        let longitudeIdx = 0;
        let latitudeIdx = 0;
        let crsIdx = 0;
        const rows = [];
        for await (const line of parser) {
            if (index === 0) {
                const header = line;
                longitudeIdx = header.indexOf('代表点_経度');
                latitudeIdx = header.indexOf('代表点_緯度');
                crsIdx = header.indexOf('代表点_座標参照系');
                index += 1;
                continue;
            }
            const [longitude, latitude] = (0, proj4_1.default)(line[crsIdx], // from
            'EPSG:4326', // to
            [
                parseFloat(line[longitudeIdx]),
                parseFloat(line[latitudeIdx]),
            ]);
            rows.push([
                longitude,
                latitude,
                ...line.slice(0, indexCols),
            ]);
            index += 1;
        }
        db.transaction(() => {
            for (const row of rows) {
                try {
                    stmt.run(row);
                }
                catch (e) {
                    console.error('error in row', row, e);
                    throw e;
                }
            }
        })();
        console.timeLog(`sqlite`, `[位置参照] ${type} (${fileArea}) 格納完了`);
        await node_fs_1.default.promises.rm(p);
    }
    // Insert metadata at the end of the run
    metaStmt.run('last_modified', meta.lastModified);
    metaStmt.run('original_file_url', meta.fileUrl);
    db.close();
}
