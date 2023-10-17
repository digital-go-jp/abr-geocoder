import { City, ICity } from '@domain/city';
import { DataField } from '@domain/dataset/data-field';
import { IPrefecture, Prefecture } from '@domain/prefecture';
import { PrefectureName } from '@domain/prefecture-name';
import { Database, Statement } from 'better-sqlite3';

export const getPrefecturesFromDB = async ({
  db,
}: {
  db: Database;
}): Promise<IPrefecture[]> => {
  const statement: Statement = db.prepare(`
    SELECT
      pref_name AS "name",
      json_group_array(json_object(
        'name', (
          "${DataField.COUNTY_NAME.dbColumn}" || 
          "${DataField.CITY_NAME.dbColumn}" || 
          "${DataField.OD_CITY_NAME.dbColumn}"
        ),
        '${DataField.LG_CODE.dbColumn}', "${DataField.LG_CODE.dbColumn}"
      )) AS "cities"
    FROM city
    GROUP BY pref_name
  `);

  const prefectures = statement.all() as {
    name: string;
    cities: string;
  }[];
  return prefectures.map(value => {
    const townRawValues: ICity[] = JSON.parse(value.cities);
    const cities = townRawValues.map(value => {
      return new City(value);
    });

    return new Prefecture({
      name: value.name as PrefectureName,
      cities,
    });
  });
};
