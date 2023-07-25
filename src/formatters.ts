import {formatResidentialSection} from './engine/formatting';
import {NormalizeResult} from './engine/normalize';

export function json(r: NormalizeResult): NormalizeResult {
  return r;
}

export interface GeoJsonResult {
  type: string;
  geometry: {
    type: string;
    coordinates: number[];
  };
  properties: {
    title: string;
    level: number;
    pref?: string;
    city?: string;
    lg_code?: string;
    town?: string;
    town_id?: string;
    blk?: string;
    blk_id?: string;
    addr1?: string;
    addr1_id?: string;
    addr2?: string;
    addr2_id?: string;
    other?: string;
  };
}

export function geoJson(r: NormalizeResult): GeoJsonResult {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [r.lon!, r.lat!],
    },
    properties: {
      title: `${r.pref}${r.city}${r.town}${formatResidentialSection(r)}`,
      level: r.level,
      pref: r.pref,
      city: r.city,
      lg_code: r.lg_code,
      town: r.town,
      town_id: r.town_id,
      blk: r.blk,
      blk_id: r.blk_id,
      addr1: r.addr1,
      addr1_id: r.addr1_id,
      addr2: r.addr2,
      addr2_id: r.addr2_id,
      other: r.other,
    },
  };
}
