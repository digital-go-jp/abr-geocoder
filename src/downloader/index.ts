import path from "node:path";
import { DatasetMetadata } from "../types";
import { getDatasetMetadata } from './getDatasetMetadata';
import { getArchiveMetadata } from './getArchiveMetadata';
import type BetterSqlite3 from 'better-sqlite3';
import Database from "better-sqlite3";

export interface DownloaderOptions {
  ckanId: string,
  sqliteDirPath: string;
  ckanBaseUrl: string;
  userAgent: string;
}

export class Downloader {
  private readonly sqliteArchivePath: string;
  private readonly ckanId: string;
  private readonly ckanBaseUrl: string;
  private readonly userAgent: string;
  private readonly db: BetterSqlite3.Database;
  
  constructor({
    ckanId,
    sqliteDirPath,
    ckanBaseUrl,
    userAgent,
  }: DownloaderOptions) {
    this.ckanId = ckanId;
    this.ckanBaseUrl = ckanBaseUrl;
    this.userAgent = userAgent;

    this.sqliteArchivePath = path.join(
      sqliteDirPath,
      `${ckanId}.sqlite`,
    );

    this.db = new Database(
      this.sqliteArchivePath,
    );
  }
  async getDatasetMetadata({
    ckanId,
  }: {
    ckanId: string;
  }): Promise<DatasetMetadata> {
    return await getDatasetMetadata({
      ckanBaseUrl: this.ckanBaseUrl,
      ckanId: this.ckanId,
      userAgent: this.userAgent,
    });
  }

  async updateCheck() {

    const upstreamMeta = await this.getDatasetMetadata({
      ckanId: this.ckanId
    });
    const currentArchiveMeta = await getArchiveMetadata({
      db: this.db,
    });

    // we'll test to see if the modified date we have in our archive is earlier
    // than the newest modified date in the archive.
    const updateAvailable = (() => {
      if (!currentArchiveMeta?.last_modified) {
        return true;
      }
      return currentArchiveMeta.last_modified < upstreamMeta.lastModified;
    })();

    return {
      updateAvailable,
      upstreamMeta,
      localFile: this.sqliteArchivePath,
    };
  }
}
