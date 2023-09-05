import { PrefectureName } from './types';

export interface IQuery {
  // ファイルから入力された住所（最後まで変更しない）
  input: string;

  // 作業用の変数
  tempAddress: string;

  prefecture?: PrefectureName;

  city?: string;

  town?: string;

  town_id?: string;

  lg_code?: string;

  lat: number | null;

  lon: number | null;

  block?: string;

  block_id?: string;

  addr1?: string;

  addr1_id?: string;

  addr2?: string;

  addr2_id?: string;
  
  latlon_acculate?: string;
}

export type QueryParams = IQuery;

export class Query implements IQuery {
  public readonly input: string;
  public readonly tempAddress: string;
  public readonly prefecture?: PrefectureName;
  public readonly city?: string;
  public readonly town?: string;
  public readonly town_id?: string;
  public readonly lg_code?: string;
  public readonly lat: number | null;
  public readonly lon: number | null;
  public readonly block?: string;
  public readonly block_id?: string;
  public readonly addr1?: string;
  public readonly addr1_id?: string;
  public readonly addr2?: string;
  public readonly addr2_id?: string;

  private constructor(params: QueryParams) {
    this.input = params.input;
    this.tempAddress = params.tempAddress;
    this.prefecture = params.prefecture;
    this.city = params.city;
    this.town = params.town;
    this.town_id = params.town_id;
    this.lg_code = params.lg_code;
    this.lat = params.lat;
    this.lon = params.lon;
    this.block = params.block;
    this.block_id = params.block_id;
    this.addr1 = params.addr1;
    this.addr1_id = params.addr1_id;
    this.addr2 = params.addr2;
    this.addr2_id = params.addr2_id;
    Object.freeze(this);
  }

  public copy(newValues: Partial<QueryParams>): Query {
    // inputは上書き不可
    return new Query(
      Object.assign(
        {
          prefecture: this.prefecture,
          city: this.city,
          town: this.town,
          town_id: this.town_id,
          lg_code: this.lg_code,
          tempAddress: this.tempAddress,
          lat: this.lat,
          lon: this.lon,
          block: this.block,
          block_id: this.block_id,
          addr1: this.addr1,
          addr1_id: this.addr1_id,
          addr2: this.addr2,
          addr2_id: this.addr2_id,
        },
        newValues,
        {
          input: this.input,
        }
      )
    );
  }

  static create = (address: string): Query => {
    address = address.trim();
    return new Query({
      input: address,
      tempAddress: address,
      lat: null,
      lon: null,
    });
  };
}
