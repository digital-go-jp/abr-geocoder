import { Query } from '@domain/query';

export const AddressFinderForStep7 = jest.fn().mockImplementation(() => ({
  find: jest.fn().mockImplementation(async (query: Query): Promise<Query> => {
    return query;
  }),
}));
