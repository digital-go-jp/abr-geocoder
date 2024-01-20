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
import { toRegexPattern } from '@domain/geocode/to-regex-pattern';
import { isKanjiNumberFollewedByCho } from '@domain/is-kanji-number-follewed-by-cho';
import { kan2num } from '@domain/kan2num';
import { PrefectureName } from '@domain/prefecture-name';
import { RegExpEx } from '@domain/reg-exp-ex';
import { ITown } from '@domain/town';
import { zen2HankakuNum } from '@domain/zen2hankaku-num';
import {
  DASH,
  DASH_SYMBOLS,
  J_DASH,
  KANJI_1to10_SYMBOLS,
} from '@settings/constant-values';
import { Database, Statement } from 'better-sqlite3';

export type TownRow = {
  lg_code: string;
  town_id: string;
  name: string;
  koaza: string;
  lat: number;
  lon: number;
};

export type TownPattern = {
  town: ITown;
  pattern: string;
};

export type FindParameters = {
  address: string;
  prefecture: PrefectureName;
  city: string;
};

/**
 * 与えられた情報をもとに、Databaseを探索して可能性のある結果を返す
 * オリジナルコードの getNormalizedCity() 関連を１つにまとめたクラス。
 * 実質的にジオコーディングしている部分
 */
export class AddressFinderForStep3and5 {
  private readonly getTownStatement: Statement;
  private readonly wildcardHelper: (address: string) => string;
  constructor({
    db,
    wildcardHelper,
  }: {
    db: Database;
    wildcardHelper: (address: string) => string;
  }) {
    this.wildcardHelper = wildcardHelper;

    // getTownList() で使用するSQLをstatementにしておく
    // "name"の文字数が長い順にソートする
    this.getTownStatement = db.prepare(`
      select
        "town".${DataField.LG_CODE.dbColumn},
        "town"."${DataField.TOWN_ID.dbColumn}",
        "${DataField.OAZA_TOWN_NAME.dbColumn}" || "${DataField.CHOME_NAME.dbColumn}" as "name",
        "${DataField.KOAZA_NAME.dbColumn}" as "koaza",
        "${DataField.REP_PNT_LAT.dbColumn}" as "lat",
        "${DataField.REP_PNT_LON.dbColumn}" as "lon"
      from
        "city"
        left join "town" on town.${DataField.LG_CODE.dbColumn} = city.${DataField.LG_CODE.dbColumn}
      where
        "city"."${DataField.PREF_NAME.dbColumn}" = @prefecture AND
        (
          "city"."${DataField.COUNTY_NAME.dbColumn}" ||
          "city"."${DataField.CITY_NAME.dbColumn}" ||
          "city"."${DataField.OD_CITY_NAME.dbColumn}"
        ) = @city AND
        "${DataField.TOWN_CODE.dbColumn}" <> 3
        order by length("name") desc;
    `);
  }

  async find({
    address,
    prefecture,
    city,
  }: FindParameters): Promise<ITown | null> {
    /*
     * オリジナルコード
     * https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L133-L164
     */
    address = address.trim().replace(RegExpEx.create('^大字'), '');
    const isKyotoCity = city.startsWith('京都市');

    // 都道府県名と市町村名から、その地域に所属する町（小区分）のリストをDatabaseから取得する
    const towns = await this.getTownList({
      prefecture,
      city,
    });
    // console.log(JSON.stringify(towns, null, 2));

    // // Trie木を作成
    // const townTree = this.buildTrieTreeForTownRow(towns);
    // const n = address.length;
    // let head : TrieNode | undefined = new TrieNode(0, townTree);
    // let tail : TrieNode | undefined = head;

    // while (head) {
    //   const current = head;
    //   head = head.next;

    //   if (n == current.position) {
    //     const info = current.trie.info;
    //     if (!info) {
    //       continue;
    //     }
    //     // 条件に一致するtownが見つかったケース
    //     return {
    //       lg_code: info.lg_code,
    //       lat: info.lat,
    //       lon: info.lon,
    //       originalName: town.originalName,
    //       town_id: info.town_id,
    //       koaza: info.koaza,
    //       name: info.name,
    //       tempAddress: '',
    //     };
    //   }
    //   const char = address[current.position];
    //   if (current.position)
    // }

    // データベースから取得したリストから、マッチしそうな正規表現パターンを作成する
    const searchPatterns = this.createSearchPatterns({
      towns,
      isKyotoCity,
    });
    const townPatterns = this.toTownPatterns(searchPatterns);

    const regexPrefixes = ['^'];
    if (isKyotoCity) {
      // 京都は通り名削除のために後方一致を使う
      regexPrefixes.push('.*');
    }

    // 作成した正規表現パターンに基づき、マッチするか全部試す
    for (const regexPrefix of regexPrefixes) {
      for (const { town, pattern } of townPatterns) {
        const modifiedPattern = this.wildcardHelper(pattern);
        if (modifiedPattern === undefined) {
          continue;
        }
        const regex = RegExpEx.create(`${regexPrefix}${modifiedPattern}`);
        const match = address.match(regex);
        if (!match) {
          continue;
        }

        // 条件に一致するtownが見つかったケース
        return {
          lg_code: town.lg_code,
          lat: town.lat,
          lon: town.lon,
          originalName: town.originalName,
          town_id: town.town_id,
          koaza: town.koaza,
          name: town.name,
          tempAddress: address.substring(match[0].length),
        };
      }
    }

    // 条件に一致するtownが見つからない場合、nullを返す
    return null;
  }

  /**
   * オリジナルコード
   * https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/lib/cacheRegexes.ts#L206-L318
   */
  private createSearchPatterns({
    towns,
    isKyotoCity,
  }: {
    towns: TownRow[];
    isKyotoCity: boolean;
  }): ITown[] {
    const townSet = new Set(towns.map(town => town.name));

    // 町丁目に「○○町」が含まれるケースへの対応
    // 通常は「○○町」のうち「町」の省略を許容し同義語として扱うが、まれに自治体内に「○○町」と「○○」が共存しているケースがある。
    // この場合は町の省略は許容せず、入力された住所は書き分けられているものとして正規化を行う。
    // 更に、「愛知県名古屋市瑞穂区十六町1丁目」漢数字を含むケースだと丁目や番地・号の正規化が不可能になる。このようなケースも除外。
    const results: ITown[] = [];

    // 京都は通り名削除の処理があるため、意図しないマッチになるケースがある。これを除く
    if (isKyotoCity) {
      towns.forEach(town => {
        results.push({
          ...town,
          originalName: '',
        });
      });

      return results;
    }

    towns.forEach(town => {
      results.push({
        ...town,
        originalName: '',
      });

      if (!town.name.includes('町')) {
        return;
      }

      // 冒頭の「町」が付く地名（町田市など）は明らかに省略するべきないので、除外
      const townAddr = town.name.replace(RegExpEx.create('(?!^町)町', 'g'), '');

      if (townSet.has(townAddr)) {
        return;
      }

      // 大字は省略されるため、大字〇〇と〇〇町がコンフリクトする。このケースを除外
      if (townSet.has(`大字${townAddr}`)) {
        return;
      }

      if (isKanjiNumberFollewedByCho(town.name)) {
        return;
      }

      // エイリアスとして「〇〇町」の"町"なしパターンを登録
      results.push({
        name: townAddr,
        originalName: town.name,
        lg_code: town.lg_code,
        town_id: town.town_id,
        koaza: town.koaza,
        lat: town.lat,
        lon: town.lon,
      });
    });

    return results;
  }

  private toTownPatterns(searchPatterns: ITown[]): TownPattern[] {
    // 少ない文字数の地名に対してミスマッチしないように文字の長さ順にソート
    searchPatterns.sort((townA: ITown, townB: ITown) => {
      let aLen = townA.name.length;
      let bLen = townB.name.length;

      // 大字で始まる場合、優先度を低く設定する。
      // 大字XX と XXYY が存在するケースもあるので、 XXYY を先にマッチしたい
      if (townA.name.startsWith('大字')) aLen -= 2;
      if (townB.name.startsWith('大字')) bLen -= 2;

      return bLen - aLen;
    });

    const patterns = searchPatterns.map(town => {
      const pattern = toRegexPattern(
        town.name
          // 横棒を含む場合（流通センター、など）に対応
          .replace(RegExpEx.create(`[${DASH_SYMBOLS}]`, 'g'), `[${DASH}]`)
          .replace(RegExpEx.create('大?字', 'g'), '(大?字)?')
          // 以下住所マスターの町丁目に含まれる数字を正規表現に変換する
          .replace(
            RegExpEx.create(
              `([壱${KANJI_1to10_SYMBOLS}]+)(丁目?|番(町|丁)|条|軒|線|(${J_DASH})町|地割|号)`,
              'g'
            ),
            (match: string) => {
              const patterns: string[] = [];

              patterns.push(
                match
                  .toString()
                  .replace(
                    RegExpEx.create(
                      `(丁目?|番(町|丁)|条|軒|線|(${J_DASH})町|地割|号)`
                    ),
                    ''
                  )
              );

              // 漢数字
              if (match.match(RegExpEx.create('^壱'))) {
                patterns.push('一');
                patterns.push('1');
                patterns.push('１');
              } else {
                const num = match
                  .replace(
                    RegExpEx.create(`([${KANJI_1to10_SYMBOLS}]+)`, 'g'),
                    match => {
                      return kan2num(match);
                    }
                  )
                  .replace(
                    RegExpEx.create(
                      `(丁目?|番(町|丁)|条|軒|線|(${J_DASH})町|地割|号)`
                    ),
                    ''
                  );

                patterns.push(num.toString()); // 半角アラビア数字
              }

              // 以下の正規表現は、上のよく似た正規表現とは違うことに注意！
              const prefixMatchers = patterns.join('|');
              return [
                `(${prefixMatchers})`,
                `((丁|町)目?|番(町|丁)|条|軒|線|の町?|地割|号|[${DASH}])`,
              ].join('');
            }
          )
      );

      return {
        town,
        pattern,
      };
    });

    // X丁目の丁目なしの数字だけ許容するため、最後に数字だけ追加していく
    for (const town of searchPatterns) {
      const chomeMatch = town.name.match(
        RegExpEx.create(
          `^([${KANJI_1to10_SYMBOLS}]+)([${KANJI_1to10_SYMBOLS}]+)(丁目?)`
        )
      );

      if (!chomeMatch) {
        continue;
      }

      const chomeNamePart = chomeMatch[1];
      const chomeNum = chomeMatch[2];
      const pattern = toRegexPattern(
        `^${chomeNamePart}(${chomeNum}|${kan2num(chomeNum)})`
      );
      patterns.push({
        town,
        pattern,
      });
    }

    return patterns;
  }

  /**
   * SQLを実行する
   *
   * better-sqlite3自体はasyncではないが、将来的にTypeORMに変更したいので
   * asyncで関数を作っておく
   */
  private async getTownList({
    prefecture,
    city,
  }: {
    prefecture: PrefectureName;
    city: string;
  }): Promise<TownRow[]> {
    const results = this.getTownStatement.all({
      prefecture,
      city,
    }) as TownRow[];

    return Promise.resolve(
      results.map(townRow => {
        townRow.name = zen2HankakuNum(townRow.name);
        townRow.koaza = zen2HankakuNum(townRow.koaza);
        return townRow;
      })
    );
  }
}
