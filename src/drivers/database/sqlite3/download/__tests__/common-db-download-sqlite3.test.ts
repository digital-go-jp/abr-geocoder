import { DbTableName } from '@config/db-table-name';
import { TableKeyProvider } from '@domain/services/table-key-provider';
import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CommonDbDownloadSqlite3 } from '../common-db-download-sqlite3';

const openDb = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abrg-db-'));
  return new CommonDbDownloadSqlite3({
    sqliteFilePath: path.join(dir, 'common.sqlite'),
    readonly: false,
  });
};

describe('CommonDbDownloadSqlite3', () => {
  // mt_town_pos_pref** covers a whole prefecture, so one batch holds rows of
  // several municipalities. Each row must keep the city of its own lg_code.
  it('assigns city_key per row when town_pos rows span municipalities', async () => {
    const db = openDb();
    await db.townPosCsvRows([
      { lg_code: '131016', machiaza_id: '0056000', rep_lat: '35.679107', rep_lon: '139.736394' },
      { lg_code: '132012', machiaza_id: '0123000', rep_lat: '35.683015', rep_lon: '139.348861' },
    ]);

    const rows = (db as unknown as {
      driver: { prepare: (sql: string) => { all: () => Record<string, number>[] } };
    }).driver
      .prepare(`SELECT town_key, city_key FROM ${DbTableName.TOWN} ORDER BY town_key`)
      .all();

    const cityKeyOf = (lgCode: string) => TableKeyProvider.getCityKey({ lg_code: lgCode });
    const townKeyOf = (lgCode: string, machiazaId: string) =>
      TableKeyProvider.getTownKey({ lg_code: lgCode, machiaza_id: machiazaId });

    expect(rows).toHaveLength(2);
    expect(new Map(rows.map(row => [row.town_key, row.city_key]))).toEqual(
      new Map([
        [townKeyOf('131016', '0056000'), cityKeyOf('131016')],
        [townKeyOf('132012', '0123000'), cityKeyOf('132012')],
      ]),
    );
    await db.close();
  });

  it('keeps city_key per row for town rows', async () => {
    const db = openDb();
    await db.townCsvRows([
      {
        lg_code: '131016', machiaza_id: '0056000', oaza_cho: '紀尾井町', chome: '',
        koaza: '', rsdt_addr_flg: 1, koaza_aka_code: 0, machiaza_dist: '', crc32: 0,
      },
    ]);

    const row = (db as unknown as {
      driver: { prepare: (sql: string) => { get: () => Record<string, number> } };
    }).driver
      .prepare(`SELECT city_key FROM ${DbTableName.TOWN}`)
      .get();

    expect(row.city_key).toBe(TableKeyProvider.getCityKey({ lg_code: '131016' }));
    await db.close();
  });
});
