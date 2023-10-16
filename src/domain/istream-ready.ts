export interface IStreamReady {
  name: string;
  crc32: number;
  contentLength: number;
  lastModified: number;
  getStream(): Promise<NodeJS.ReadableStream>;
}