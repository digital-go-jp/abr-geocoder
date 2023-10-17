import { Database, Statement } from 'better-sqlite3';
import {
  RegExpEx,
  DataField,
  PrefectureName,
  Query,
  MatchLevel,
} from '@domain';
import { DASH } from '@settings/constant-values';

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
  }

  async find(query: Query): Promise<Query> {
    /*
     * オリジナルコード
     * https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L133-L164
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
    const results = this.getBlockListStatement.all({
      prefecture,
      city,
      town,
    }) as TownBlock[];

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
