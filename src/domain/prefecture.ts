import { PrefectureName } from './prefecture-name';
import { ICity } from './city';

export interface IPrefecture {
  cities: ICity[];
  name: PrefectureName;
}
export type PrefectureParams = IPrefecture;

export class Prefecture implements IPrefecture {
  public readonly cities: ICity[];
  public readonly name: PrefectureName;
  constructor({ cities, name }: PrefectureParams) {
    this.cities = cities;
    this.name = name;
    Object.freeze(this);
  }
}
