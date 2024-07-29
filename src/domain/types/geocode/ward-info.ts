export type WardInfo = {
  pref_key: number;
  pref: string;
  city: string;
  county: string;
  ward: string;
  oaza_cho: string;
  lg_code: string;
  city_key: number;
  rep_lat: number;
  rep_lon: number;
};
export type WardMatchingInfo = {
  key: string;
} & WardInfo;
