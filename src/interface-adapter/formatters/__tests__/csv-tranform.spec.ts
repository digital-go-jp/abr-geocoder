import { describe, expect, it } from '@jest/globals';
import csvtojson from 'csvtojson';
import { Stream } from 'node:stream';
import { CsvTransform } from '../csv-transform';
import { dummyData } from './dummy-data';

describe('CsvTransform', () => {
  it('should output rows with expected CSV format()', async () => {
    const transform = CsvTransform.create(CsvTransform.DEFAULT_COLUMNS);

    const expectCsv = await csvtojson({
      output: 'csv',
    }).fromString(`
input, match_level, lg_code, prefecture, city, town, block, addr1, addr2, other, lat, lon
"東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階",8,131016,東京都,千代田区,紀尾井町,1,3,, 東京ガーデンテラス紀尾井町 19階、20階,35.681411,139.73495
"東京都千代田区紀尾井町1",3,131016,東京都,千代田区,紀尾井町,,,,,35.681411,139.73495
"山形県山形市旅篭町二丁目3番25号",8,062014,山形県,山形市,旅篭町二丁目,3,25,,,38.255437,140.339126
"山形市旅篭町二丁目3番25号",8,062014,山形県,山形市,旅篭町二丁目,3,25,,,38.255437,140.339126
"東京都町田市森野2-2-22",8,132098,東京都,町田市,森野二丁目,2,22,,,35.548247,139.440264`.trim());

    const buffer: string[] = [];
    const writable = new Stream.Writable({
      objectMode: true,
      write(chunk, encoding, callback) {
        buffer.push(chunk.toString());
        callback();
      },
    })
    const readStream = Stream.Readable.from(dummyData);

    await Stream.promises.pipeline(
      readStream,
      transform,
      writable,
    )
    
    const resultCSV = await csvtojson({
      output: 'csv',
    }).fromString(buffer.join('').trim());
    
    expect(resultCSV).toEqual(expectCsv);
  });
});
