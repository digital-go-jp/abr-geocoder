import { Stream } from "stream";

export const getReadStreamFromSource = () => {
  return Stream.Readable.from(['test']);
};
