import { Dispatcher, request } from 'undici';

export const getRequest = async ({
  url,
  userAgent,
  headers,
}: {
  url: string;
  userAgent: string;
  headers?: { [key: string]: string | undefined };
}): Promise<Dispatcher.ResponseData> => {
  return await request(url, {
    headers: {
      'user-agent': userAgent,
      ...headers,
    },
  });
};
