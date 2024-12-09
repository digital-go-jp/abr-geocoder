import { AbrGeocoderDiContainer } from "@usecases/geocode/models/abr-geocoder-di-container";

export type CreateCacheTaskParams = {
  diContainer: AbrGeocoderDiContainer;
  data: CreateCacheType;
  isSilentMode: boolean;
}
export type CreateCacheType = 'pref' | 'county-and-city' | 'city-and-ward' | 'kyoto-street' | 'oaza-cho' | 'tokyo23-town' | 'tokyo23-ward' | 'ward';

export type CreateCacheResult = {
  result: boolean;
} & CreateCacheType;
