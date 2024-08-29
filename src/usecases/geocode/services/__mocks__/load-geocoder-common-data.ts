import { jest } from '@jest/globals';

export const removeGeocoderCommonDataCache = jest.fn();

export const loadGeocoderCommonData = jest.fn(() => {
  return Promise.resolve({
    prefList: [],
    countyAndCityList: [],
    cityAndWardList: [],
    wardAndOazaList: [],
    oazaChomes: [],
    tokyo23towns: [],
    tokyo23wards: [],
    wards: [],
  });
});