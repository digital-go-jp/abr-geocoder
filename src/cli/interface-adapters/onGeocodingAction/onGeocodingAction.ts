import { OutputFormat } from './OutputFormat';
import { geocodeFromStream } from './geocodeFromStream';
import { getReadStreamFromSource } from './getReadStreamFromSource';

export const onGeocodingAction = async ({
  source,
  destination,
  dataDir,
  resourceId,
  format,
  fuzzy = '?',
} : {
  source: string;
  destination: string;
  dataDir: string | undefined;
  resourceId: string;
  format: OutputFormat;
  fuzzy: string;
}) => {
  const readStream = getReadStreamFromSource(source);

  const output = await geocodeFromStream({
    source: readStream,
    dataDir,
    resourceId,
    fuzzy,
  });

  output.pipe(process.stdout);
}



