import { PrefectureName } from '../../../domain';
import { FindParameters } from '../AddressFinderForStep3and5';

export const AddressFinderForStep3and5 = jest.fn().mockImplementation(() => {
  return {
    find: (params: FindParameters) => {
      switch (params.prefecture) {
        case PrefectureName.TOKYO:
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
          return Promise.resolve(null);

        default:
          throw new Error(
            `Unexpected prefecture was given: ${params.prefecture}`
          );
      }
    },
  };
});
