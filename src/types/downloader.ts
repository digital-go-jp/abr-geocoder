export type CheckForUpdatesOutput = {
  updateAvailable: boolean;
  upstreamMeta: DatasetMetadata;
};

export type ArchiveMetadata = {
  // last_modified: string;
  [key: string]: string | number;
};

export type DatasetMetadata = {
  fileUrl: string;
  lastModified: string;
};

export type CKANResponse<T> =
  | {
      success: false;
    }
  | {
      success: true;
      result: T;
    };

export type CKANPackageShow = {
  id: string;
  title: string;
  resources: CKANPackageResource[];
};

export type CKANPackageResource = {
  description: string;
  last_modified: string;
  id: string;
  url: string;
  format: string;
};

export interface IArchiveMeta {
  key: string;
  value: string | number;
}
