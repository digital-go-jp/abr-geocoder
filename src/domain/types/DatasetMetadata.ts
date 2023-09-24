export class DatasetMetadata {
  public readonly lastModified?: string;
  public readonly contentLength: number;
  public readonly etag?: string;
  public readonly fileUrl: string;
  
  constructor(params: {
    lastModified?: string;
    contentLength: number;
    etag?: string;
    fileUrl: string;
  }) {
    this.lastModified = params.lastModified;
    this.contentLength = params.contentLength;
    this.etag = params.etag;
    this.fileUrl = params.fileUrl;
    Object.freeze(this);
  }

  toJSON() {
    return {
      lastModified: this.lastModified,
      contentLength: this.contentLength,
      etag: this.etag,
      fileUrl: this.fileUrl
    };
  }

  toString() {
    return JSON.stringify(this.toJSON());
  }

  static from = (value: string): DatasetMetadata => {
    const jsonValue = JSON.parse(value);
    if (!('lastModified' in jsonValue) ||
      !('contentLength' in jsonValue) ||
      !('etag' in jsonValue) ||
      !('fileUrl' in jsonValue)) {
        throw new Error('Can not parse value as DatasetMetadata');
    }
    return new DatasetMetadata(jsonValue);
  }
}