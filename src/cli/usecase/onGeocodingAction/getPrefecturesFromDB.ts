import {Database, Statement} from 'better-sqlite3';
import {
  IPrefecture,
  ITown,
  Prefecture,
  PrefectureDB,
  PrefectureType,
  Town,
} from './types';

export const getPrefecturesFromDB = async ({
  db,
}: {
  db: Database;
}): Promise<IPrefecture[]> => {
  const statement: Statement = db.prepare(`
    SELECT
      pref_name AS "todofuken_name",
      json_group_array(json_object(
        'name', country_name || city_name || od_city_name,
        'code', "code"
      )) AS "towns"
    FROM city
    GROUP BY pref_name
  `);

  const prefectures = statement.all() as PrefectureDB[];
  return prefectures.map((value: PrefectureDB) => {
    const townRawValues: ITown[] = JSON.parse(value.towns);
    const towns = townRawValues.map(value => {
      return new Town(value);
    });

    return new Prefecture({
      todofuken_name: value.todofuken_name as PrefectureType,
      towns,
    });
  });
};
