import { jest } from '@jest/globals';
import { PrefectureName } from '@domain/prefecture-name';
import { FindParameters } from '../address-finder-for-step3and5';

export const AddressFinderForStep3and5 = jest.fn().mockImplementation(() => {
  return {
    find: (params: FindParameters) => {
      switch (params.prefecture) {
        case PrefectureName.TOKYO:
          //
          // Dummy result for step3b-transform.spec.ts
          //
          return Promise.resolve({
            lg_code: '132063',
            town_id: '0001002',
            name: '本宿町2丁目',
            koaza: '',
            lat: 35.672654,
            lon: 139.46089,
            originalName: '',
            tempAddress: '22番地の22',
          });

        case PrefectureName.HIROSHIMA:
          //
          // Dummy result for step3b-transform.spec.ts
          //
          return Promise.resolve(null);

        case PrefectureName.KYOTO:
          //
          // Dummy result for step5-transform.spec.ts
          //
          return Promise.resolve({
            koaza: '',
            lat: 34.877027, 
            lg_code: '262102',
            lon: 135.708529,
            name: '八幡園内',
            originalName: '',
            tempAddress: '75', 
            town_id: '0302000'
          });

        default:
          throw new Error(
            `Unexpected prefecture was given: ${params.prefecture}`
          );
      }
    },
  };
});
