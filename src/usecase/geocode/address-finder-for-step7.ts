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
import { isDigit } from '@domain/is-digit';
import { MatchLevel } from '@domain/match-level';
import { PrefectureName } from '@domain/prefecture-name';
import { Query } from '@domain/query';
import { RegExpEx } from '@domain/reg-exp-ex';
import { Trie } from '@domain/trie';
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
  private readonly getRsdtListStatement2: Statement;
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
          town.${DataField.CHOME_NAME.dbColumn} ||
          town.${DataField.KOAZA_NAME.dbColumn}
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

    this.getRsdtListStatement2 = db.prepare(`
      /* unit test: getRsdtListStatement2 */

      select
        ${DataField.ADDR_ID.dbColumn} as "addr1_id",
        ${DataField.ADDR2_ID.dbColumn} as "addr2_id",
        ${DataField.RSDT_NUM.dbColumn} as "addr1",
        ${DataField.RSDT_NUM2.dbColumn} as "addr2",
        ${DataField.REP_PNT_LAT.dbColumn} as "lat",
        ${DataField.REP_PNT_LON.dbColumn} as "lon"
      from
        "rsdtdsp_rsdt"
      where
        ${DataField.LG_CODE.dbColumn} = @lg_code and
        ${DataField.TOWN_ID.dbColumn} = @town_id and
        ${DataField.BLK_ID.dbColumn} = @block_id
      order by
        ${DataField.RSDT_NUM.dbColumn} desc,
        ${DataField.RSDT_NUM2.dbColumn} desc
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
    // console.log(JSON.stringify(cityBlocks, null, 2));

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
      // if (
      //   koaza_name[0] === '字' &&
      //   tempAddress !== '字' &&
      //   tempAddress.startsWith(koaza_name.substring(1))
      // ) {
      //   return this.parseBlockNumbers(
      //     query.copy({
      //       town: `${query.town}${koaza_name}`,
      //       town_id: cityBlock.town_id,
      //       lg_code: cityBlock.lg_code,
      //       lat: cityBlock.lat,
      //       lon: cityBlock.lon,
      //       match_level: MatchLevel.TOWN_LOCAL,
      //       tempAddress: tempAddress.replace(
      //         RegExpEx.create(`^${koaza_name.substring(1)}`),
      //         ''
      //       ),
      //     })
      //   );
      // }

      if (!tempAddress.startsWith(koaza_name)) {
        continue;
      }
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

  private getSimplifiedTown(townBlock: TownBlock): string {
    const buffer: string[] = [];
    let i = 0;
    const town = zen2HankakuNum(townBlock.town);
    const n = town.length;
    let hasNumber = false;
    while (i < n) {
      const char = town[i];
      if (!isDigit(char)) {
        const twoChars = town.slice(i, i + 2);
        if (!hasNumber) {
          buffer.push(char);
          i++;
          continue;
        }

        if (twoChars === '丁目' || twoChars === '番地') {
          i++;
        } else if (town[i] !== '号') {
          buffer.push(char);
        }
        i++;
        continue;
      }
      hasNumber = true;
      buffer.push(char);
      i++;
    }
    if (hasNumber) {
      buffer.push(DASH);
    }
    if (townBlock.blk !== '') {
      buffer.push(townBlock.blk);
    }
    return buffer.join('');
  }

  private buildTrieTreeForTownBlock(sqlRows: TownBlock[]): Trie<TownBlock> {
    const townBlockTree = new Trie<TownBlock>();
    sqlRows.forEach((townBlock: TownBlock) => {
      let parent = townBlockTree;
      const simplifiedTown = this.getSimplifiedTown(townBlock);

      for (const char of simplifiedTown) {
        const trie = parent.children.get(char) || new Trie<TownBlock>();
        parent.children.set(char, trie);
        parent = trie;
      }
      parent.info = townBlock;
    });
    return townBlockTree;
  }

  private buildMapForRsdtAddr(sqlRows: RsdtAddr[]): Map<string, RsdtAddr> {
    const result = new Map<string, RsdtAddr>();
    sqlRows.forEach((addr: RsdtAddr) => {
      const buffer: string[] = [];
      if (addr.addr1 !== '') {
        buffer.push(addr.addr1.toString());
        if (addr.addr2 !== '') {
          buffer.push(DASH);
          buffer.push(addr.addr1.toString());
        }
      }
      const addr1_and_addr2 = buffer.join('');
      result.set(addr1_and_addr2, addr);
    });
    return result;
  }

  async find(query: Query): Promise<Query> {
    const townBlocks = await this.getBlockList({
      prefecture: query.prefecture!,
      city: query.city!,
      town: query.town!,
    });

    // console.log(JSON.stringify(townBlocks, null, 2));
    const townBlockTree: Trie<TownBlock> =
      this.buildTrieTreeForTownBlock(townBlocks);

    query = (query => {
      const tempAddress = `${query.town}${query.tempAddress}`.replace(
        RegExpEx.create('([1-9][0-9]?)(丁目|番地|号)'),
        '$1'
      );

      let parent = townBlockTree;
      for (let i = 0; i < tempAddress.length; i++) {
        const char = tempAddress[i];
        const child = parent.children.get(char);
        if (child) {
          parent = child;
          continue;
        }

        if (!parent.info) {
          // DBにはマッチする街区データがない
          return query;
        }

        // 完全一致ではないが、一部見つかった場合
        // 例：宮城県登米市迫町佐沼字中江1-1-7 のうち、宮城県登米市迫町佐沼字中江1-1 までは見つかるケース
        break;
      }

      const info = parent.info;
      if (!info) {
        // DBにはマッチする街区データがない
        return query;
      }

      // for文を breakしないで最後までループできる場合は、最後まで見つかるケース
      // 例：東京都千代田区紀尾井町1
      const result = query.copy({
        town: info.town,
        lat: info.lat,
        lon: info.lon,
        lg_code: info.lg_code,
        block: info.blk,
        block_id: info.blk_id,
        town_id: info.town_id,
        tempAddress: tempAddress.substring(info.town.length + 1),
        match_level: MatchLevel.RESIDENTIAL_BLOCK,
      });
      return result;
    })(query);

    return query;
  }

  async findDetail(query: Query): Promise<Query> {
    if (!query.town_id || !query.lg_code) {
      return query;
    }

    // 残されている文字列から番地の取得
    const match = query.tempAddress.match(
      RegExpEx.create(`^${DASH}?([1-9][0-9]*)(?:${DASH}([1-9][0-9]*))?`)
    );
    if (!match) {
      return query;
    }

    const addr1: string = match[1];
    const addr2: string | undefined = match[2];

    const rsdtList = await this.getRsdtList2({
      town_id: query.town_id,
      block_id: query.block_id || '',
      lg_code: query.lg_code,
    });

    const rsdtHashMap: Map<string, RsdtAddr> =
      this.buildMapForRsdtAddr(rsdtList);
    const buffer: string[] = [addr1];
    if (addr2 !== undefined) {
      buffer.push(DASH, addr2);
    }
    const key = buffer.join('');
    const rsdt = rsdtHashMap.get(key);
    if (!rsdt) {
      return query;
    }

    return query.copy({
      addr1: rsdt.addr1,
      addr1_id: rsdt.addr1_id,
      addr2: rsdt.addr2,
      addr2_id: rsdt.addr2_id,
      lat: rsdt.lat,
      lon: rsdt.lon,
      match_level: MatchLevel.RESIDENTIAL_DETAIL,
      tempAddress: query.tempAddress.substring(match[0].length),
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

    return Promise.resolve(
      results.map(smallBlock => {
        smallBlock.koaza_name = zen2HankakuNum(smallBlock.koaza_name);
        smallBlock.town = zen2HankakuNum(smallBlock.town);
        return smallBlock;
      })
    );
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

    return Promise.resolve(
      results.map(town => {
        town.town = zen2HankakuNum(town.town);
        return town;
      })
    );
  }

  private async getRsdtList2({
    lg_code,
    town_id,
    block_id,
  }: {
    lg_code: string;
    town_id: string;
    block_id: string;
  }): Promise<RsdtAddr[]> {
    const results = this.getRsdtListStatement2.all({
      lg_code,
      town_id,
      block_id,
    }) as RsdtAddr[];

    // better-sqlite3自体はasyncではないが、将来的にTypeORMに変更したいので
    // asyncで関数を作っておく
    return Promise.resolve(results);
  }
}
