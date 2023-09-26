export interface IDatasetRow {
  key: string;
  type: string;
  contentLength: number;
  crc32: number;
  lastModified: number;
}

export class DatasetRow implements IDatasetRow {
  public readonly key: string;
  public readonly type: string;
  public readonly contentLength: number;
  public readonly crc32: number;
  public readonly lastModified: number;

  constructor({
    key,
    type,
    contentLength,
    crc32,
    lastModified,
  }: {
    key: string;
    type: string;
    contentLength: number;
    crc32: number;
    lastModified: number;
  }) {
    this.key = key;
    this.type = type;
    this.contentLength = contentLength;
    this.crc32 = crc32;
    this.lastModified = lastModified;
    Object.freeze(this);
  }

  equalExceptType(other?: {
    key: string;
    contentLength: number;
    crc32: number;
    lastModified: number;
  }) {
    if (!other) {
      return false;
    }
    return (
      this.key === other.key &&
      this.crc32 === other.crc32 &&
      this.contentLength === other.contentLength &&
      this.lastModified === other.lastModified
    );
  }
}
