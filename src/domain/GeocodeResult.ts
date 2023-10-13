import { MatchLevel } from './matchLevel.enum';

export enum GeocodeResultFields {
  INPUT = 'input',
  MATCH_LEVEL = 'match_level',
  LATITUDE = 'lat',
  LONGITUDE = 'lon',
  OTHER = 'other',
  PREFECTURE = 'prefecture',
  CITY = 'city',
  TOWN = 'town',
  TOWN_ID = 'town_id',
  LG_CODE = 'lg_code',
  BLOCK = 'block',
  BLOCK_ID = 'block_id',
  ADDR1 = 'addr1',
  ADDR1_ID = 'addr1_id',
  ADDR2 = 'addr2',
  ADDR2_ID = 'addr2_id',
}

export class GeocodeResult {
  constructor(
    public readonly input: string,
    public readonly match_level: MatchLevel,
    public readonly lat: number | null,
    public readonly lon: number | null,
    public readonly other: string,
    public readonly prefecture?: string,
    public readonly city?: string,
    public readonly town?: string,
    public readonly town_id?: string,
    public readonly lg_code?: string,
    public readonly block?: string,
    public readonly block_id?: string,
    public readonly addr1?: string,
    public readonly addr1_id?: string,
    public readonly addr2?: string,
    public readonly addr2_id?: string
  ) {
    Object.freeze(this);
  }
}
