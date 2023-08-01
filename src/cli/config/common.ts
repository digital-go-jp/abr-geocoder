import {container, instanceCachingFactory} from "tsyringe";
import type BetterSqlite3 from "better-sqlite3";
import Database from "better-sqlite3";
import fs from 'node:fs';
import { createLogger, transports, format } from "winston";
import { SingleBar } from "cli-progress";
import prettyBytes from "pretty-bytes";
import { CkanDownloader } from "../class/CkanDownloader";

export const commonInitialize = async ({
  schemaFilePath,
  sqliteFilePath,
  silent = false,
}: {
  schemaFilePath: string;
  sqliteFilePath: string;
  silent: boolean;
}) => {
  const db = await provideDatabase({
    schemaFilePath,
    sqliteFilePath,
  })
  container.register('Database', {
    useValue: db,
  });

  const logger = provideLogger();
  container.registerInstance('Logger', silent ? null : logger);

  const progress = provideDownloadProgressBar();
  container.registerInstance('DownloadProgressBar', silent ? null : progress);

  container.register('Downloader', {
    useFactory: instanceCachingFactory<CkanDownloader>(c => c.resolve(CkanDownloader)),
  });
};

const provideDownloadProgressBar = (): SingleBar => {
  return new SingleBar({
    format: ' {bar} {percentage}% | ETA: {eta_formatted} | {value}/{total}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    etaBuffer: 30,
    fps: 2,
    formatValue: (v, options, type) => {
      if (type === 'value' || type === 'total') {
        return prettyBytes(v);
      }

      // no autopadding ? passthrough
      if (options.autopadding !== true) {
        return v.toString();
      }

      // padding
      function autopadding(value: number, length: number) {
        return ((options.autopaddingChar || ' ') + value).slice(-length);
      }

      switch (type) {
        case 'percentage':
          return autopadding(v, 3);

        default:
          return v.toString();
      }
    },
  });
};

const provideLogger = () => {
  return createLogger({
    transports: [new transports.Console()],
    format: format.combine(
      format.colorize(),
      format.timestamp(),
      format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] ${level}: ${message}`;
      })
    ),
  });
}

const provideDatabase = async ({
  sqliteFilePath,
  schemaFilePath,
}: {
  sqliteFilePath: string,
  schemaFilePath: string,
}): Promise<BetterSqlite3.Database> => {
  const schemaSQL = await fs.promises.readFile(schemaFilePath, 'utf8');
  const db = new Database(sqliteFilePath);

  // We use these dangerous settings to improve performance, because if data is corrupted,
  // we can always just regenerate the database.
  // ref: https://qastack.jp/programming/1711631/improve-insert-per-second-performance-of-sqlite
  db.pragma('journal_mode = MEMORY');
  db.pragma('synchronous = OFF');
  db.exec(schemaSQL);
  return db;
}