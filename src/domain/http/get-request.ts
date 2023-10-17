import { Dispatcher, request } from 'undici';

export type getRequestParams = {
  url: string;
  userAgent: string;
  headers?: { [key: string]: string | undefined };
};

export const getRequest = async ({
  url,
  userAgent,
  headers,
}: getRequestParams): Promise<Dispatcher.ResponseData> => {
  return await request(url, {
    headers: {
      'user-agent': userAgent,
      ...headers,
    },
  });
};
