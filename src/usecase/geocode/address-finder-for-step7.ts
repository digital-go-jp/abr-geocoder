/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
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
import { DataField } from '@domain/dataset/data-field';
import { MatchLevel } from '@domain/match-level';
import { PrefectureName } from '@domain/prefecture-name';
import { Query } from '@domain/query';
import { RegExpEx } from '@domain/reg-exp-ex';
import { zen2HankakuNum } from '@domain/zen2hankaku-num';
import { DASH, SPACE } from '@settings/constant-values';
import { Database, Statement } from 'better-sqlite3';

export type TownSmallBlock = {
  lg_code: string;
  town_id: string;
  koaza_name: string;
  pref: string;
  city: string;
  town: string;
  lat: number;
  lon: number;
};

export type TownBlock = {
  lg_code: string;
  town_id: string;
  blk_id: string;
  pref: string;
  city: string;
  town: string;
  blk: string;
  lat: number;
  lon: number;
};

// Rsdt は Residential の略っぽい
export type RsdtAddr = {
  lg_code: string;
  town_id: string;
  blk_id: string;
  addr1_id: string;
  addr2_id: string;
  blk: string;
  addr1: string;
  addr2: string;
  lat: number;
  lon: number;
};

/**
 * 与えられた情報をもとに、Databaseを探索して可能性のある結果を返す
 * オリジナルコードの getNormalizedCity() 関連を１つにまとめたクラス。
 * 実質的にジオコーディングしている部分
 */
export class AddressFinderForStep7 {
  private readonly getBlockListStatement: Statement;
  private readonly getRsdtListStatement: Statement;
  private readonly getSmallBlockListStatement: Statement;

  constructor(db: Database) {
    this.getBlockListStatement = db.prepare(`
      /* unit test: getBlockListStatement */

      select
        "blk".${DataField.LG_CODE.dbColumn},
        "blk".${DataField.TOWN_ID.dbColumn},
        "blk".${DataField.BLK_ID.dbColumn},
        city.${DataField.PREF_NAME.dbColumn} as "pref",
        (
          city.${DataField.COUNTY_NAME.dbColumn} ||
          city.${DataField.CITY_NAME.dbColumn} ||
          city.${DataField.OD_CITY_NAME.dbColumn}
        ) as "city",
        (
          town.${DataField.OAZA_TOWN_NAME.dbColumn} ||
          town.${DataField.CHOME_NAME.dbColumn}
        ) as "town",
        blk.${DataField.BLK_NUM.dbColumn} as "blk",
        blk.${DataField.REP_PNT_LAT.dbColumn} as "lat",
        blk.${DataField.REP_PNT_LON.dbColumn} as "lon"
      from
        "city"
        left join "town" on
          town.${DataField.LG_CODE.dbColumn} = city.${DataField.LG_CODE.dbColumn} and
          (town.${DataField.OAZA_TOWN_NAME.dbColumn} || town.${DataField.CHOME_NAME.dbColumn} = @town)
        left join "rsdtdsp_blk" "blk" on
          blk.${DataField.LG_CODE.dbColumn} = city.${DataField.LG_CODE.dbColumn} and
          blk.${DataField.TOWN_ID.dbColumn} = town.${DataField.TOWN_ID.dbColumn}
      where
        city.${DataField.PREF_NAME.dbColumn} = @prefecture AND 
        (
          "city".${DataField.COUNTY_NAME.dbColumn} ||
          "city".${DataField.CITY_NAME.dbColumn} ||
          "city".${DataField.OD_CITY_NAME.dbColumn}
        ) = @city and
        blk.${DataField.BLK_NUM.dbColumn} is not null
    `);

    this.getRsdtListStatement = db.prepare(`
      /* unit test: getRsdtListStatement */

      select
        "rsdt".${DataField.LG_CODE.dbColumn},
        "rsdt".${DataField.TOWN_ID.dbColumn},
        "rsdt".${DataField.BLK_ID.dbColumn},
        "rsdt".${DataField.ADDR_ID.dbColumn} as "addr1_id",
        "rsdt".${DataField.ADDR2_ID.dbColumn},
        blk.${DataField.BLK_NUM.dbColumn} as "blk",
        rsdt.${DataField.RSDT_NUM.dbColumn} as "addr1",
        rsdt.${DataField.RSDT_NUM2.dbColumn} as "addr2",
        rsdt.${DataField.REP_PNT_LAT.dbColumn} as "lat",
        rsdt.${DataField.REP_PNT_LON.dbColumn} as "lon"
      from "city"
        left join "town" on 
          town.${DataField.LG_CODE.dbColumn} = city.${DataField.LG_CODE.dbColumn} and
          (
            town.${DataField.OAZA_TOWN_NAME.dbColumn} ||
            town.${DataField.CHOME_NAME.dbColumn} = @town
          )
        left join "rsdtdsp_blk" "blk" on
          blk.${DataField.LG_CODE.dbColumn} = city.${DataField.LG_CODE.dbColumn} and
          blk.${DataField.TOWN_ID.dbColumn} = town.${DataField.TOWN_ID.dbColumn}
        left join "rsdtdsp_rsdt" "rsdt" on
          rsdt.${DataField.LG_CODE.dbColumn} = city.${DataField.LG_CODE.dbColumn} and
          rsdt.${DataField.TOWN_ID.dbColumn} = town.${DataField.TOWN_ID.dbColumn} and
          rsdt.${DataField.BLK_ID.dbColumn} = blk.${DataField.BLK_ID.dbColumn}
      where
        city.${DataField.PREF_NAME.dbColumn} = @prefecture AND
        (
          "city".${DataField.COUNTY_NAME.dbColumn} ||
          "city".${DataField.CITY_NAME.dbColumn} ||
          "city".${DataField.OD_CITY_NAME.dbColumn}
        ) = @city and
        blk.${DataField.BLK_NUM.dbColumn} is not null and
        (
          rsdt.${DataField.RSDT_NUM.dbColumn} is not null or
          rsdt.${DataField.RSDT_NUM2.dbColumn} is not null
        )
    `);

    this.getSmallBlockListStatement = db.prepare(`
      /* unit test: getSmallBlockListStatement */

      select
        "town".${DataField.LG_CODE.dbColumn},
        "town".${DataField.TOWN_ID.dbColumn},
        city.${DataField.PREF_NAME.dbColumn} as "pref",
        (
          city.${DataField.COUNTY_NAME.dbColumn} ||
          city.${DataField.CITY_NAME.dbColumn} ||
          city.${DataField.OD_CITY_NAME.dbColumn}
        ) as "city",
        (
          town.${DataField.OAZA_TOWN_NAME.dbColumn} ||
          town.${DataField.CHOME_NAME.dbColumn}
        ) as "town",
        town.${DataField.KOAZA_NAME.dbColumn},
        town.${DataField.REP_PNT_LAT.dbColumn} as "lat",
        town.${DataField.REP_PNT_LON.dbColumn} as "lon"
      from
        "city"
        left join "town" on
        "town".${DataField.LG_CODE.dbColumn} = city.${DataField.LG_CODE.dbColumn} and
          (town.${DataField.OAZA_TOWN_NAME.dbColumn} || town.${DataField.CHOME_NAME.dbColumn} = @town)
      where
        city.${DataField.PREF_NAME.dbColumn} = @prefecture AND 
        (
          "city".${DataField.COUNTY_NAME.dbColumn} ||
          "city".${DataField.CITY_NAME.dbColumn} ||
          "city".${DataField.OD_CITY_NAME.dbColumn}
        ) = @city AND
        "town".${DataField.KOAZA_NAME.dbColumn} like @koaza
      order by
        town.${DataField.KOAZA_NAME.dbColumn} desc
    `);
  }

  // 小字を検索する
  async findForKoaza(query: Query): Promise<Query> {
    const koaza = ((addr: string) => {
      const temp: string[] = addr.split(/\d/);
      return temp[0];
    })(query.tempAddress);

    const cityBlocks = await this.getSmallBlockList({
      prefecture: query.prefecture!,
      city: query.city!,
      town: query.town!,
      koaza,
    });

    if (cityBlocks.length === 0) {
      return query;
    }

    const tempAddress = query.tempAddress.replace(
      RegExpEx.create(`^${koaza}`),
      ''
    );
    if (cityBlocks.length === 1) {
      const koaza_name = zen2HankakuNum(cityBlocks[0].koaza_name);
      const result = cityBlocks[0];

      return this.parseBlockNumbers(
        query.copy({
          town: `${query.town}${result.koaza_name}`,
          town_id: result.town_id,
          lg_code: result.lg_code,
          lat: result.lat,
          lon: result.lon,
          match_level: MatchLevel.TOWN_LOCAL,
          tempAddress: tempAddress.replace(
            RegExpEx.create(`^${koaza_name}`),
            ''
          ),
        })
      );
    }

    for (const cityBlock of cityBlocks) {
      const koaza_name = zen2HankakuNum(cityBlock.koaza_name);
      if (tempAddress.startsWith(koaza_name)) {
        return this.parseBlockNumbers(
          query.copy({
            town: `${query.town}${koaza_name}`,
            town_id: cityBlock.town_id,
            lg_code: cityBlock.lg_code,
            lat: cityBlock.lat,
            lon: cityBlock.lon,
            match_level: MatchLevel.TOWN_LOCAL,
            tempAddress: tempAddress.replace(
              RegExpEx.create(`^${koaza_name}`),
              ''
            ),
          })
        );
      }
    }

    return query;
  }

  private parseBlockNumbers(query: Query): Query {
    const match = query.tempAddress.match(
      RegExpEx.create(
        `^([1-9][0-9]*)(?:${DASH}([1-9][0-9]*))?(?:${DASH}([1-9][0-9]*))?`
      )
    );
    if (!match) {
      return query;
    }
    const tempAddress = query.tempAddress.replace(
      RegExpEx.create(`^${match[0]}${SPACE}*`),
      ''
    );
    return query.copy({
      block: match[1],
      addr1: match[2],
      addr2: match[3],
      tempAddress,
    });
  }

  async find(query: Query): Promise<Query> {
    /*
     * オリジナルコード
     * https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L177-L256
     */

    const townBlocks = await this.getBlockList({
      prefecture: query.prefecture!,
      city: query.city!,
      town: query.town!,
    });

    // 住居表示未整備
    if (townBlocks.length === 0) {
      return query;
    }

    const rsdtMap = new Map<string, RsdtAddr>();
    (
      await this.getRsdtList({
        prefecture: query.prefecture!,
        city: query.city!,
        town: query.town!,
      })
    ).forEach((rsdt: RsdtAddr) => {
      const key = this.formatResidentialSection({
        blockNum: rsdt.blk,
        addr1: rsdt.addr1,
        addr2: rsdt.addr2,
      });
      rsdtMap.set(key, rsdt);
    });

    // 番地の取得
    const match = query.tempAddress.match(
      RegExpEx.create(
        `^([1-9][0-9]*)(?:${DASH}([1-9][0-9]*))?(?:${DASH}([1-9][0-9]*))?`
      )
    );
    if (!match) {
      return query;
    }
    query = query.copy({
      tempAddress: query.tempAddress.substring(match[0].length),
    });

    const blockNum: string | undefined = match[1];
    const addr1: string | undefined = match[2];
    const addr2: string | undefined = match[3];

    // 〇〇県 市〇〇 1-1-1 みたいな感じ
    const pattern1 = this.formatResidentialSection({
      blockNum,
      addr1,
      addr2,
    });

    if (rsdtMap.has(pattern1)) {
      const rsdt: RsdtAddr = rsdtMap.get(pattern1)!;
      return query.copy({
        block: blockNum,
        block_id: rsdt.blk_id,
        addr1: addr1,
        addr1_id: rsdt.addr1_id,
        addr2: addr2 || '',
        addr2_id: rsdt.addr2_id,
        lat: rsdt.lat || query.lat,
        lon: rsdt.lon || query.lon,
        lg_code: rsdt.lg_code,
        town_id: rsdt.town_id,

        // 住居表示の街区符号・住居番号までの判別ができた
        match_level: MatchLevel.RESIDENTIAL_DETAIL,
      });
    }

    // 〇〇県 市〇〇 1-1 みたいな感じ
    const pattern2 = this.formatResidentialSection({
      blockNum,
      addr1,
    });

    if (rsdtMap.has(pattern2)) {
      const rsdt: RsdtAddr = rsdtMap.get(pattern2)!;
      return query.copy({
        lg_code: rsdt.lg_code,
        block: blockNum,
        block_id: rsdt.blk_id,
        addr1: addr1,
        addr1_id: rsdt.addr1_id,
        addr2: addr2,
        addr2_id: rsdt.addr2_id,
        lat: rsdt.lat || query.lat,
        lon: rsdt.lon || query.lon,
        town_id: rsdt.town_id,
        tempAddress: (addr2 ? `${DASH}${addr2}` : '') + query.tempAddress,

        // 住居表示の街区符号・住居番号までの判別ができた
        match_level: MatchLevel.RESIDENTIAL_DETAIL,
      });
    }

    // 番地情報がないケースはそのまま返す
    if (!rsdtMap.has(blockNum)) {
      return query;
    }

    // 〇〇県 市〇〇 1 みたいな感じ
    const rsdt: RsdtAddr = rsdtMap.get(blockNum)!;
    const otherWithUnmatchedAddrs = [
      addr1 ? `${DASH}${addr1}` : '',
      addr2 ? `${DASH}${addr2}` : '',
      query.tempAddress,
    ].join('');
    return query.copy({
      block: blockNum,
      block_id: rsdt.blk_id,
      tempAddress: otherWithUnmatchedAddrs,
      lat: rsdt.lat || query.lat,
      lon: rsdt.lon || query.lon,
      town_id: rsdt.town_id,
      lg_code: rsdt.lg_code,

      // 住居表示の街区までの判別ができた
      match_level: MatchLevel.RESIDENTIAL_BLOCK,
    });
  }
  private async getSmallBlockList({
    prefecture,
    city,
    town,
    koaza,
  }: {
    prefecture: PrefectureName;
    city: string;
    town: string;
    koaza: string;
  }): Promise<TownSmallBlock[]> {
    const results = (await this.getSmallBlockListStatement.all({
      prefecture,
      city,
      town,
      koaza: `${koaza}%`,
    })) as TownSmallBlock[];

    return Promise.resolve(results);
  }

  /**
   * SQLを実行する
   *
   * better-sqlite3自体はasyncではないが、将来的にTypeORMに変更したいので
   * asyncで関数を作っておく
   *
   * オリジナルコード
   * https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/lib/cacheRegexes.ts#L141-L161
   */
  private async getBlockList({
    prefecture,
    city,
    town,
  }: {
    prefecture: PrefectureName;
    city: string;
    town: string;
  }): Promise<TownBlock[]> {
    const results = (await this.getBlockListStatement.all({
      prefecture,
      city,
      town,
    })) as TownBlock[];

    return Promise.resolve(results);
  }

  /**
   * SQLを実行する
   *
   * better-sqlite3自体はasyncではないが、将来的にTypeORMに変更したいので
   * asyncで関数を作っておく
   *
   * オリジナルコード
   * https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/lib/cacheRegexes.ts#L163-L196
   */
  private async getRsdtList({
    prefecture,
    city,
    town,
  }: {
    prefecture: PrefectureName;
    city: string;
    town: string;
  }): Promise<RsdtAddr[]> {
    const results = this.getRsdtListStatement.all({
      prefecture,
      city,
      town,
    }) as RsdtAddr[];

    results.sort((a, b) => {
      return (
        this.formatResidentialSection(b).length -
        this.formatResidentialSection(a).length
      );
    });
    return Promise.resolve(results);
  }

  /**
   * オリジナルコード
   * https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/formatting.ts#L1-L8
   */
  private formatResidentialSection({
    blockNum,
    addr1,
    addr2,
  }: {
    blockNum?: string;
    addr1?: string;
    addr2?: string;
  }) {
    return [blockNum, addr1, addr2].filter(x => !!x).join(DASH);
  }
}
