export interface ITown {
  name: string;
  lg_code: string;
  town_id: string;
  koaza: string;
  lat: number;
  lon: number;
  originalName?: string;
  tempAddress?: string;
}

export class Town implements ITown {
  public readonly name: string;
  public readonly lg_code: string;
  public readonly town_id: string;
  public readonly koaza: string;
  public readonly lat: number;
  public readonly lon: number;

  constructor(params: ITown) {
    this.name = params.name;
    this.lg_code = params.lg_code;
    this.town_id = params.town_id;
    this.koaza = params.koaza;
    this.lat = params.lat;
    this.lon = params.lon;
    Object.freeze(this);
  }
}
