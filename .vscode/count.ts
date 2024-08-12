import fs from 'node:fs';
import path from 'node:path';
import csvParser from 'csv-parser';
import { Writable } from 'node:stream';

const stream = fs.createReadStream(path.normalize('/Users/maskatsum/Downloads/output-simple.csv'));

const counts = new Map<number, number>();
const counts2 = new Map<string, number>();

let total = 0;
stream.pipe(csvParser({
  headers: false,
}))
.pipe(new Writable({
  objectMode: true,
  write(chunk: [string, string, string, string], _, callback) {
    total++;
    const score = Math.floor(parseFloat(chunk[1]) * 10) / 10;
    counts.set(score, (counts.get(score) || 0) + 1);

    const level = chunk[3];
    counts2.set(level, (counts2.get(level) || 0) + 1);
    callback();
  },
}))
.once('close', () => {
  const keys = Array.from(counts.keys()).sort((a, b) => {
    return b - a
  });

  console.log('| score | counts | percentage |');
  console.log ('|:------|:------|:-------|')
  keys.forEach(score => {
    const cnt = counts.get(score)!;
    console.log(`| ${score} | ${cnt} | ${((cnt/ total) * 100).toFixed(1)} % |`);
  })

  console.log("");
  console.log('| level | counts | percentage |');
  console.log ('|:------|:------|:-------|')
  for (const level of ["prefecture", "administrative_area", "town_local", "machiaza", "residential_block", "residential_detail", "parcel"]) {
    const cnt = counts2.get(level);
    console.log(`| ${level} | ${cnt} | ${(((cnt || 0)/ total) * 100).toFixed(1)} % |`);
  }
})