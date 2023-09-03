import { IPrefecture, PrefectureName } from "./types";

export interface IQuery {
  // ファイルから入力された住所（最後まで変更しない）
  originalInput: string;

  tempAddress: string;

  prefectureName?: PrefectureName;

  city?: string;

  town?: string;

  townId?: string;

  lg_code?: string;

  lat: number;

  lon: number;
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
    Object.freeze(this);
  }

  public copy(newValues: Partial<QueryParams>): Query {
    // inputは上書き不可
    return new Query(
      Object.assign({
        prefectureName: this.prefectureName,
        city: this.city,
        town: this.town,
        townId: this.townId,
        lg_code: this.lg_code,
        tempAddress: this.tempAddress,
        lat: this.lat,
        lon: this.lon,
      },
      newValues,
      {
        originalInput: this.originalInput,
      }),
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
  }
}