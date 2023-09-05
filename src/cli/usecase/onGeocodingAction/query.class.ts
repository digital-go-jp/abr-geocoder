import { IPrefecture, PrefectureName } from './types';

export interface IQuery {
  // ファイルから入力された住所（最後まで変更しない）
  originalInput: string;

  // 作業用の変数
  tempAddress: string;

  prefectureName?: PrefectureName;

  city?: string;

  town?: string;

  townId?: string;

  lg_code?: string;

  lat: number;

  lon: number;

  block?: string;

  blockId?: string;

  addr1?: string;

  addr1Id?: string;

  addr2?: string;

  addr2Id?: string;
}

export type QueryParams = IQuery;

export class Query implements IQuery {
  public readonly originalInput: string;
  public readonly tempAddress: string;
  public readonly prefectureName?: PrefectureName;
  public readonly city?: string;
  public readonly town?: string;
  public readonly townId?: string;
  public readonly lg_code?: string;
  public readonly lat: number;
  public readonly lon: number;
  public readonly block?: string;
  public readonly blockId?: string;
  public readonly addr1?: string;
  public readonly addr1Id?: string;
  public readonly addr2?: string;
  public readonly addr2Id?: string;

  private constructor(params: QueryParams) {
    this.originalInput = params.originalInput;
    this.tempAddress = params.tempAddress;
    this.prefectureName = params.prefectureName;
    this.city = params.city;
    this.town = params.town;
    this.townId = params.townId;
    this.lg_code = params.lg_code;
    this.lat = params.lat;
    this.lon = params.lon;
    this.block = params.block;
    this.blockId = params.blockId;
    this.addr1 = params.addr1;
    this.addr1Id = params.addr1Id;
    this.addr2 = params.addr2;
    this.addr2Id = params.addr2Id;
    Object.freeze(this);
  }

  public copy(newValues: Partial<QueryParams>): Query {
    // inputは上書き不可
    return new Query(
      Object.assign(
        {
          prefectureName: this.prefectureName,
          city: this.city,
          town: this.town,
          townId: this.townId,
          lg_code: this.lg_code,
          tempAddress: this.tempAddress,
          lat: this.lat,
          lon: this.lon,
          block: this.block,
          blockId: this.blockId,
          addr1: this.addr1,
          addr1Id: this.addr1Id,
          addr2: this.addr2,
          addr2Id: this.addr2Id,
        },
        newValues,
        {
          originalInput: this.originalInput,
        }
      )
    );
  }

  static create = (address: string): Query => {
    address = address.trim();
    return new Query({
      originalInput: address,
      tempAddress: address,
      lat: Number.NaN,
      lon: Number.NaN,
    });
  };
}
