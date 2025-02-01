import { AbrGeocoderDiContainer } from "@usecases/geocode/models/abr-geocoder-di-container";

export type CreateCacheType = 'pref' | 'county-and-city' | 'city-and-ward' | 'kyoto-street' | 'oaza-cho' | 'chome-koaza' | 'tokyo23-town' | 'tokyo23-ward' | 'ward';

export type CreateCacheTaskData = {
  type: CreateCacheType;
  lg_code?: string;
};

export type CreateCacheTaskParams = {
  diContainer: AbrGeocoderDiContainer;
  data: CreateCacheTaskData;
};

export type CreateCacheResult = {
  result: boolean;
} & CreateCacheType;
