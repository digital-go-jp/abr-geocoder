import { SearchTarget } from "@domain/types/search-target";

export type AbrGeocoderInput = {
  address: string;
  searchTarget: SearchTarget;
  fuzzy?: string | undefined;
  tag?: Omit<Object, 'Function'>;
};