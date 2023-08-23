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
  parseFilename
} from '../../domain/';
import { fsIteratorResult } from './fsIterator';
import { provideProgressBar } from '../../interface-adapter';

export const loadDatasetProcess = async({
  db,
  csvFiles,
  multiProgressBar,
}: {
  db: Database;
  csvFiles: fsIteratorResult[];
  multiProgressBar: MultiBar,
}) => {

  // 各ファイルを処理する
  const filesStream = Stream.Readable.from(csvFiles, {
    objectMode: true,
  });
  filesStream.on('finish', () => {
    console.log('fileStream is finished');
  })

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

      switch(fileMeta.type) {
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
          callback(null, RsdtdspBlkPosFile.create(fileMeta, chunk.stream));
          break;
        case 'rsdtdsp_rsdt_pos':
          callback(null, RsdtdspRsdtPosFile.create(fileMeta, chunk.stream));
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
      let total = 0;
      db.exec('BEGIN');
      datasetFile.inputStream
        .pipe(csvParser({
          skipComments: true,
        }))
        .pipe(new Stream.Writable({
          objectMode: true,
          write(chunk, encoding, next) {
            const processed = datasetFile.process(chunk);
            statement.run(processed);
            next(null);
          },
        }))
        .on('finish', () => {
          db.exec('COMMIT');
          
          loadDataProgress.increment();
          loadDataProgress.updateETA();
          callback(null);
        })
        .on('error', (error) => {
          if (db.inTransaction) {
            db.exec('ROLLBACK');
          }
          callback(error);
        });
    },
  });

  await pipeline(
    filesStream,
    fileParseStream,
    loadDataStream,
  )

  loadDataProgress.stop();
  multiProgressBar.remove(loadDataProgress);
}
