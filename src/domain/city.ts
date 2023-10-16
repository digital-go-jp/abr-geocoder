export interface ICity {
  name: string;
  lg_code: string;
}

export class City implements ICity {
  public readonly name: string;
  public readonly lg_code: string;

  constructor(params: ICity) {
    this.name = params.name;
    this.lg_code = params.lg_code;
    Object.freeze(this);
  }
}
