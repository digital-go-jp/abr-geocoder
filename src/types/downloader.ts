export type CheckForUpdatesOutput = {
  updateAvailable: boolean;
  upstreamMeta: DatasetMetadata;
  localFile: string;
};

export type ArchiveMetadata = {
  last_modified?: string;
};

export type DatasetMetadata = {
  fileUrl: string;
  lastModified: string;
};
