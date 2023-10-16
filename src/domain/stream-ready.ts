import StreamZip from "node-stream-zip";
import { IStreamReady } from './istream-ready';

export class StreamReady implements IStreamReady {
  private streamFactory: () => Promise<NodeJS.ReadableStream>;
  public readonly name: string;
  public readonly crc32: number;
  public readonly contentLength: number;
  public readonly lastModified: number;

  constructor({
    zipEntry,
    streamFactory,
  }: {
    streamFactory: () => Promise<NodeJS.ReadableStream>;
    zipEntry: StreamZip.ZipEntry;
  }) {
    this.streamFactory = streamFactory;
    this.name = zipEntry.name;
    this.crc32 = zipEntry.crc;
    this.lastModified = zipEntry.time;
    this.contentLength = zipEntry.size;
    Object.freeze(this);
  }

  async getStream(): Promise<NodeJS.ReadableStream> {
    return await this.streamFactory();
  }
}