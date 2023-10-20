import { IStreamReady } from "@domain/istream-ready";

export class DummyCsvFile implements IStreamReady {
  public name: string;
  public crc32: number;
  public contentLength: number;
  public lastModified: number;

  constructor(public params: {
    name: string;
    crc32: number;
    contentLength: number;
    lastModified: number;
    getStream: () => Promise<NodeJS.ReadableStream>,
  }) {
    this.name = params.name;
    this.crc32 = params.crc32;
    this.contentLength = params.contentLength;
    this.lastModified = params.lastModified;
  }

  getStream(): Promise<NodeJS.ReadableStream> {
    return this.params.getStream();
  }
}