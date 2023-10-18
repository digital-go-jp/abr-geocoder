import { PassThrough } from 'node:stream';

export default jest.fn().mockImplementation(() => {
  return new PassThrough({
    objectMode: true,
  })
});