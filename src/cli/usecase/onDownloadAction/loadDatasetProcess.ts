import { Database } from 'better-sqlite3';
import { MultiBar } from 'cli-progress';
import csvParser from 'csv-parser';
import { Stream } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  CityDatasetFile,
  DatasetFile,
  PrefDatasetFile,
  RsdtdspBlkFile,
  RsdtdspBlkPosFile,
  RsdtdspRsdtFile,
  RsdtdspRsdtPosFile,
  TownDatasetFile,
  TownPosDatasetFile,
  parseFilename,
} from '../../domain/';
import { fsIteratorResult } from './fsIterator';

export const loadDatasetProcess = async ({
  db,
  csvFiles,
  multiProgressBar,
}: {
  db: Database;
  csvFiles: fsIteratorResult[];
  multiProgressBar: MultiBar;
}) => {
  // _pos_ ファイルのSQL が updateになっているので、
  // それ以外の基本的な情報を先に insert する必要がある。
  // そのため _pos_ がファイル名に含まれている場合は、
  // 後方の順番になるように並び替える
  csvFiles = csvFiles.sort((a, b) => {
    const isA_posFile = a.name.includes('_pos_');
    const isB_posFile = b.name.includes('_pos_');
    if (isA_posFile && !isB_posFile) {
      return 1;
    }

    if (!isA_posFile && isB_posFile) {
      return -1;
    }
    for (let i = 0; i < Math.min(a.name.length, b.name.length); i++) {
      const diff = a.name.charCodeAt(i) - b.name.charCodeAt(i);
      if (diff !== 0) {
        return diff;
      }
    }
    return a.name.length - b.name.length;
  });

  // 各ファイルを処理する
  const filesStream = Stream.Readable.from(csvFiles, {
    objectMode: true,
  });
  filesStream.on('finish', () => {
    console.log('fileStream is finished');
  });

  const fileParseProgresss = multiProgressBar.create(csvFiles.length, 0, {
    filename: 'analysis...',
  });

  const fileParseStream = new Stream.Transform({
    objectMode: true,
    transform(chunk: fsIteratorResult, encoding, callback) {
      fileParseProgresss.increment();

      // ファイル名から情報を得る
      const fileMeta = parseFilename({
        filepath: chunk.name,
      });
      if (!fileMeta) {
        // skip
        console.log(`[skip]--->${chunk.name}`);
        callback();
        return;
      }

      switch (fileMeta.type) {
        case 'pref':
          callback(null, PrefDatasetFile.create(fileMeta, chunk.stream));
          break;
        case 'city':
          callback(null, CityDatasetFile.create(fileMeta, chunk.stream));
          break;
        case 'town':
          callback(null, TownDatasetFile.create(fileMeta, chunk.stream));
          break;
        case 'rsdtdsp_blk':
          callback(null, RsdtdspBlkFile.create(fileMeta, chunk.stream));
          break;
        case 'rsdtdsp_rsdt':
          callback(null, RsdtdspRsdtFile.create(fileMeta, chunk.stream));
          break;
        case 'town_pos':
          callback(null, TownPosDatasetFile.create(fileMeta, chunk.stream));
          break;
        case 'rsdtdsp_blk_pos':
          console.log(`---->skip ${fileMeta.filename}`);
          callback(null);
          // callback(null, RsdtdspBlkPosFile.create(fileMeta, chunk.stream));
          break;
        case 'rsdtdsp_rsdt_pos':
          console.log(`---->skip ${fileMeta.filename}`);
          callback(null);
          // callback(null, RsdtdspRsdtPosFile.create(fileMeta, chunk.stream));
          break;
        default:
          console.log(`[error]--->${chunk.name}`);
          throw new Error(`unknown type: ${fileMeta.type}`);
      }
    },
  });

  const loadDataProgress = multiProgressBar.create(csvFiles.length, 0, {
    filename: 'loading...',
  });
  const loadDataStream = new Stream.Writable({
    objectMode: true,
    write(datasetFile: DatasetFile, encoding, callback) {
      // 1ファイルごと transform() が呼び出される

      // CSVファイルの読み込み
      const statement = db.prepare(datasetFile.sql);

      // DBに登録
      db.exec('BEGIN');
      datasetFile.inputStream
        .pipe(
          csvParser({
            skipComments: true,
          })
        )
        .pipe(
          new Stream.Writable({
            objectMode: true,
            write(chunk, encoding, next) {
              const processed = datasetFile.process(chunk);
              statement.run(processed);
              next(null);
            },
          })
        )
        .on('finish', () => {
          db.exec('COMMIT');

          loadDataProgress.increment();
          loadDataProgress.updateETA();
          callback(null);
        })
        .on('error', error => {
          if (db.inTransaction) {
            db.exec('ROLLBACK');
          }
          callback(error);
        });
    },
  });

  await pipeline(filesStream, fileParseStream, loadDataStream);

  loadDataProgress.stop();
  multiProgressBar.remove(loadDataProgress);
};
// const test = async () => {
//   const downloadDir = '/Users/maskatsum/.abr-geocoder/download';
//   const tmpDir = await fs.promises.mkdtemp(downloadDir);
//   const fileLoadingProgress = new CLIInfinityProgress();
//   fileLoadingProgress.setHeader('Finding dataset files...');
//   fileLoadingProgress.start();
//   const csvFiles = await fsIterator(
//     tmpDir,
//     downloadDir,
//     '.csv',
//     fileLoadingProgress
//   );
//   fileLoadingProgress.remove();

//   const db = await provideDatabase({
//     sqliteFilePath: '/Users/maskatsum/.abr-geocoder/download.sqlite',
//     schemaFilePath:
//       '/Volumes/digital/abr-geocoder/src/cli/interface-adapter/schema.sql',
//   });

//   await loadDatasetProcess({
//     db,
//     csvFiles,
//     multiProgressBar: provideMultiProgressBar(),
//   });
// };
// test();
