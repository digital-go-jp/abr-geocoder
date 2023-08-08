
import fs from 'node:fs';
import path from 'node:path';
import {Database} from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import {walkDir} from '../../../utils';
import StreamZip from 'node-stream-zip';
import csvParse from 'csv-parse';
import proj4 from 'proj4';
proj4.defs('EPSG:4612', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');
proj4.defs('EPSG:6668', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');

const parseFilename = (
  filename: string
): undefined | {type: string; fileArea: string} => {
  const fileMatch = filename.match(
    /^mt_(city|pref|(?:town|rsdtdsp_(?:rsdt|blk))(?:_pos)?)_(all|pref\d{2})/
  );
  if (!fileMatch) {
    return undefined;
  }
  const type = fileMatch[1];
  const fileArea = fileMatch[2];
  return {type, fileArea};
};

export interface createSqliteArchiveOptions {
  db: Database;
  inputDir: string;
}
export const createSqliteArchive = async ({
  db,
  inputDir,
}: createSqliteArchiveOptions): Promise<void> => {

  const settings: {
    [key: string]: {
      indexCols: number;
      validDateCol: number;
      stmt: BetterSqlite3.Statement<any[]>;
    };
  } = {
    pref: {
      indexCols: 1,
      validDateCol: 4,
      stmt: db.prepare(
        'INSERT OR REPLACE INTO "pref" ("code", "都道府県名", "都道府県名_カナ", "都道府県名_英字", "効力発生日", "廃止日", "備考") VALUES (?, ?, ?, ?, ?, ?, ?)'
      ),
    },
    city: {
      indexCols: 1,
      validDateCol: 14,
      stmt: db.prepare(
        'INSERT OR REPLACE INTO "city" ("code", "都道府県名", "都道府県名_カナ", "都道府県名_英字", "郡名", "郡名_カナ", "郡名_英字", "市区町村名", "市区町村名_カナ", "市区町村名_英字", "政令市区名", "政令市区名_カナ", "政令市区名_英字", "効力発生日", "廃止日", "備考") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ),
    },
    town: {
      indexCols: 2,
      validDateCol: 32,
      stmt: db.prepare(
        'INSERT OR REPLACE INTO "town" ("code", "town_id", "町字区分コード", "都道府県名", "都道府県名_カナ", "都道府県名_英字", "郡名", "郡名_カナ", "郡名_英字", "市区町村名", "市区町村名_カナ", "市区町村名_英字", "政令市区名", "政令市区名_カナ", "政令市区名_英字", "大字・町名", "大字・町名_カナ", "大字・町名_英字", "丁目名", "丁目名_カナ", "丁目名_数字", "小字名", "小字名_カナ", "小字名_英字", "住居表示フラグ", "住居表示方式コード", "大字・町名_通称フラグ", "小字名_通称フラグ", "大字・町名_電子国土基本図外字", "小字名_電子国土基本図外字", "状態フラグ", "起番フラグ", "効力発生日", "廃止日", "原典資料コード", "郵便番号", "備考") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ),
    },
    rsdtdsp_blk: {
      indexCols: 3,
      validDateCol: 14,
      stmt: db.prepare(
        'INSERT OR REPLACE INTO "rsdtdsp_blk" ("code", "town_id", "blk_id", "市区町村名", "政令市区名", "大字・町名", "丁目名", "小字名", "街区符号", "住居表示フラグ", "住居表示方式コード", "大字・町名_電子国土基本図外字", "小字名_電子国土基本図外字", "状態フラグ", "効力発生日", "廃止日", "原典資料コード", "備考") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ),
    },
    rsdtdsp_rsdt: {
      indexCols: 5,
      validDateCol: 19,
      stmt: db.prepare(
        'INSERT OR REPLACE INTO "rsdtdsp_rsdt" ("code", "town_id", "blk_id", "addr_id", "addr2_id", "市区町村名", "政令市区名", "大字・町名", "丁目名", "小字名", "街区符号", "住居番号", "住居番号2", "基礎番号・住居番号区分", "住居表示フラグ", "住居表示方式コード", "大字・町名_電子国土基本図外字", "小字名_電子国土基本図外字", "状態フラグ", "効力発生日", "廃止日", "原典資料コード", "備考") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ),
    },
  };

  const posUpdateSettings: {
    [key: string]: {
      indexCols: number;
      stmt: BetterSqlite3.Statement<any[]>;
    };
  } = {
    town_pos: {
      indexCols: 2,
      stmt: db.prepare(
        'UPDATE "town" SET "代表点_経度" = ?, "代表点_緯度" = ? WHERE "code" = ? AND "town_id" = ?'
      ),
    },
    rsdtdsp_blk_pos: {
      indexCols: 3,
      stmt: db.prepare(
        'UPDATE "rsdtdsp_blk" SET "代表点_経度" = ?, "代表点_緯度" = ? WHERE "code" = ? AND "town_id" = ? AND "blk_id" = ?'
      ),
    },
    rsdtdsp_rsdt_pos: {
      indexCols: 5,
      stmt: db.prepare(
        'UPDATE "rsdtdsp_rsdt" SET "代表点_経度" = ?, "代表点_緯度" = ? WHERE "code" = ? AND "town_id" = ? AND "blk_id" = ? AND "addr_id" = ? AND "addr2_id" = ?'
      ),
    },
  };

  console.time('sqlite');

  for await (const p of walkDir(inputDir)) {
    const filename = path.basename(p);
    const parsedFilename = parseFilename(filename);
    if (!parsedFilename) {
      continue;
    }
    const {type, fileArea} = parsedFilename;

    const usePos = type.endsWith('_pos');
    if (usePos) {
      continue;
    }

    const config = settings[type];
    if (!config) {
      continue;
    }
    const {indexCols, validDateCol, stmt} = config;

    console.timeLog('sqlite', `${type} (${fileArea}) 読み込み中...`);

    const zip = new StreamZip.async({file: p});
    const entries = await zip.entries();
    const entriesAry = Object.values(entries);
    const inputStream = await zip.stream(entriesAry[0]);
    const parser = inputStream.pipe(
      csvParse.parse({
        encoding: 'utf-8',
        from: 2,
      })
    );

    const rows: any[][] = [];

    let allRowCount = 0;
    let prevIndexKey: string | undefined;
    let prevValidDate: string | undefined;
    for await (const line of parser) {
      allRowCount += 1;
      const indexKey = [...line.slice(0, indexCols)].join('|');

      const newRow = line;

      if (prevIndexKey === indexKey) {
        if (prevValidDate && prevValidDate < newRow[validDateCol]) {
          // because the last entry of the rows array is older than the one we are about to insert, we
          // will pop it off and replace it with the newRow
          rows.pop();
        } else {
          // because the last entry of the rows array is newer than the one we are about to insert, we
          // will skip this one because the one in the array is already valid.
          continue;
        }
      }

      rows.push(newRow);
      prevIndexKey = indexKey;
      prevValidDate = newRow[validDateCol];
    }
    console.timeLog(
      'sqlite',
      `${type} (${fileArea}) 読み込み完了。入力行数: ${allRowCount}, 格納行数: ${rows.length}`
    );

    db.transaction(() => {
      for (const row of rows) {
        try {
          stmt.run(row);
        } catch (e) {
          console.error('error in row', row, e);
          throw e;
        }
      }
    })();
    console.timeLog('sqlite', `${type} (${fileArea}) 格納完了`);

    await fs.promises.rm(p);
  }

  // we run the pos files afterwards, because we need the initial data from the regular CSV files first
  for await (const p of walkDir(inputDir)) {
    const filename = path.basename(p);
    const parsedFilename = parseFilename(filename);
    if (!parsedFilename) {
      continue;
    }
    const {type, fileArea} = parsedFilename;

    const usePos = type.endsWith('_pos');
    if (!usePos) {
      continue;
    }

    const config = posUpdateSettings[type];
    if (!config) {
      continue;
    }
    const {indexCols, stmt} = config;

    console.timeLog('sqlite', `[位置参照] ${type} (${fileArea}) 読み込み中...`);

    const zip = new StreamZip.async({file: p});
    const entries = await zip.entries();
    const entriesAry = Object.values(entries);
    const inputStream = await zip.stream(entriesAry[0]);
    const parser = inputStream.pipe(
      csvParse.parse({
        encoding: 'utf-8',
        from: 1,
        quote: false,
        relax_quotes: true,
      })
    );
    let index = 0;
    let longitudeIdx = 0;
    let latitudeIdx = 0;
    let crsIdx = 0;

    const rows: any[][] = [];

    for await (const line of parser) {
      if (index === 0) {
        const header = line as string[];
        longitudeIdx = header.indexOf('代表点_経度');
        latitudeIdx = header.indexOf('代表点_緯度');
        crsIdx = header.indexOf('代表点_座標参照系');
        index += 1;
        continue;
      }

      const [longitude, latitude] = proj4(
        line[crsIdx], // from
        'EPSG:4326', // to
        [parseFloat(line[longitudeIdx]), parseFloat(line[latitudeIdx])]
      );

      rows.push([longitude, latitude, ...line.slice(0, indexCols)]);

      index += 1;
    }

    db.transaction(() => {
      for (const row of rows) {
        try {
          stmt.run(row);
        } catch (e) {
          console.error('error in row', row, e);
          throw e;
        }
      }
    })();
    console.timeLog('sqlite', `[位置参照] ${type} (${fileArea}) 格納完了`);

    await fs.promises.rm(p);
  }

};
