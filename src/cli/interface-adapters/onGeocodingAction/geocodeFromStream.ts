import byline from 'byline';
import fs from 'node:fs';
import { Readable } from "node:stream";
import {GeocoderTransform} from './GeocoderTransform';

export const geocodeFromStream = ({
  source,
  dataDir,
  resourceId,
  fuzzy,
}: {
  source: NodeJS.ReadStream | fs.ReadStream;
  dataDir: string | undefined;
  resourceId: string;
  fuzzy: string;
}): Readable => {
  
  const outputStream = new ReadableStream();

  const lines = byline.createStream();
  const readable = new GeocoderTransform();
  
  return source.pipe(lines).pipe(readable);
}
