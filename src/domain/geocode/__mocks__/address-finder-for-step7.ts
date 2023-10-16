import { Query } from '../../../domain';

export const AddressFinderForStep7 = jest.fn().mockImplementation(() => ({
  find: jest.fn().mockImplementation(async (query: Query): Promise<Query> => {
    return query;
  }),
}));
