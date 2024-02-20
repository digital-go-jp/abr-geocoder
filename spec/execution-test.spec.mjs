const trimLines = (target) => {
  return target.replace(/^\s*(.*?)\s*$/gm, '$1');
};

const { $ } = await import('zx');
const path = await import('path');
const { fileURLToPath } = await import('url');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { test } = await import('uvu');
const assert = await import('uvu/assert');
const jsonDiff = (await import('json-diff')).default;
const fs = (await import('node:fs')).default;
const which = (await import('which')).default;

class Test {

  async execute(args, input) {
    const p = $`node ${__dirname}/../build/cli/cli.js ${args} --dataDir ${__dirname} --resource demo`.quiet().stdio('pipe');
    p.stdin.write(input);
    p.stdin.end();
    return await p;
  }
}

class JsonTest extends Test {

  async validate(args, input, expectCode, expectOutput) {
    const result = await this.execute(args, input).catch(err => {
      if (expectCode === err.exitCode) {
        return;
      }
      throw err;
    })

    if (expectCode !== 0) {
      return;
    }

    if (!result) {
      throw 'output is empty';
    }
    assert.equal(result.exitCode, expectCode, `The exit code should be ${expectCode}`);
    const diffResult = jsonDiff.diffString(
      JSON.parse(trimLines(result.stdout)),
      expectOutput,
    )
    assert.equal(diffResult, '')
  }
}
class CsvTest extends Test {

  async validate(args, input, expectCode, expectOutput) {
    const result = await this.execute(args, input).catch(err => {
      if (expectCode === err.exitCode) {
        return;
      }
      throw err;
    })

    if (expectCode !== 0) {
      return;
    }

    if (!result) {
      throw 'output is empty';
    }
    assert.equal(result.exitCode, expectCode, `The exit code should be ${expectCode}`);

    const results = trimLines(result.stdout).split('\n');
    const expectCsv = trimLines(expectOutput).split('\n');

    assert.equal(results.length, expectCsv.length);

    for (let i = 0; i < results.length; i++) {
      const diffResult = jsonDiff.diffString(
        results[i],
        expectCsv[i],
      )
      assert.equal(diffResult, '')
    }
  }
}

test('setup', async () => {
  const sqlite3Path = await which('sqlite3', {
    nothrow: true,
  });
  assert.not.equal(sqlite3Path, null, '[error] sqlite3 is not installed')

  if (!fs.existsSync(`${__dirname}/demo.sqlite`)) {
    const result = await $`sqlite3 ${__dirname}/demo.sqlite < ${__dirname}/demo.sql`.quiet();
    assert.equal(result.exitCode, 0, `The exit code should be 0`);
  }
})

test(`'echo "<input data>" | abrg - -f csv' should return the expected results as CSV format`, async () => {

  const input = `
  //
  // サンプルデータ ('#' または // で始まる行はコメント行として処理します)
  //
  東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階
  東京都千代田区紀尾井町1-3　"21階、22階"
  東京都千代田区紀尾井町1-3　23,24階
  東京都千代田区九段南1丁目2-1
  `;

  const expectResult = `
    input,output,match_level,lg_code,prefecture,city,town,town_id,block,block_id,addr1,addr1_id,addr2,addr2_id,other,lat,lon
    東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階,東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階,8,131016,東京都,千代田区,紀尾井町,0056000,1,001,3,003,,,東京ガーデンテラス紀尾井町 19階、20階,35.679107172,139.736394597
    "東京都千代田区紀尾井町1-3　""21階、22階""","東京都千代田区紀尾井町1-3 ""21階、22階""",8,131016,東京都,千代田区,紀尾井町,0056000,1,001,3,003,,,"""21階、22階""",35.679107172,139.736394597
    "東京都千代田区紀尾井町1-3　23,24階","東京都千代田区紀尾井町1-3 23,24階",8,131016,東京都,千代田区,紀尾井町,0056000,1,001,3,003,,,"23,24階",35.679107172,139.736394597
    東京都千代田区九段南1丁目2-1,東京都千代田区九段南一丁目2-1,7,131016,東京都,千代田区,九段南一丁目,0008001,2,002,,,,,-1,35.693948,139.753535
    `;

  const expectExitCode = 0;
  const tester = new CsvTest();
  await tester.validate('- -f csv', input, expectExitCode, expectResult)
})


test(`'echo "<input data>" | abrg - -f normalize' should return the expected results as CSV format`, async () => {

  const input = `
  //
  // サンプルデータ ('#' または // で始まる行はコメント行として処理します)
  //
  東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階
  東京都千代田区紀尾井町1-3　"19階、20階"
  東京都千代田区紀尾井町1-3　19,20階
  東京都千代田区九段南1丁目2-1
  `;

  const expectResult = `
  input,output,match_level
  東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階,東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階,8
  "東京都千代田区紀尾井町1-3　""19階、20階""","東京都千代田区紀尾井町1-3 ""19階、20階""",8
  "東京都千代田区紀尾井町1-3　19,20階","東京都千代田区紀尾井町1-3 19,20階",8
  東京都千代田区九段南1丁目2-1,東京都千代田区九段南一丁目2-1,7
  `;

  const expectExitCode = 0;
  const tester = new CsvTest();
  await tester.validate('- -f normalize', input, expectExitCode, expectResult)
})

test(`'echo "<input data>" | abrg - -f csv' should be error because "brabrabra" is unknown file.`, async () => {

  const input = `東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階`;

  const expectResult = `[error] Can not open the source file`;

  const expectExitCode = 1;
  const tester = new CsvTest();
  await tester.validate('not_file_path -f csv', input, expectExitCode, expectResult);
})

test(`'echo "<input data>" | abrg - -f json' should return the expected results as JSON format`, async () => {

  const input = `東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階`;

  const expectResult = [
    {
      "query": { "input": "東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階" },
      "result": {
        "output": "東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階",
        "prefecture": "東京都",
        "match_level": 8,
        "city": "千代田区",
        "town": "紀尾井町",
        "town_id": "0056000",
        "lg_code": "131016",
        "other": "東京ガーデンテラス紀尾井町 19階、20階",
        "lat": 35.679107172,
        "lon": 139.736394597,
        "block": "1",
        "block_id": "001",
        "addr1": "3",
        "addr1_id": "003",
        "addr2": "",
        "addr2_id": ""
      }
    }
  ];

  const expectExitCode = 0;
  const tester = new JsonTest();
  await tester.validate('- -f json', input, expectExitCode, expectResult);
});

test(`'echo "<input data>" | abrg - -f ndjson' should return the expected results as JSON format on each line`, async () => {

  const input = `東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階`;

  const expectResult = {
    "query": {
      "input": "東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階",
    },
    "result": {
      "output": "東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階",
      "prefecture": "東京都",
      "match_level": 8,
      "city": "千代田区",
      "town": "紀尾井町",
      "town_id": "0056000",
      "lg_code": "131016",
      "other": "東京ガーデンテラス紀尾井町 19階、20階",
      "lat": 35.679107172,
      "lon": 139.736394597,
      "block": "1",
      "block_id": "001",
      "addr1": "3",
      "addr1_id": "003",
      "addr2": "",
      "addr2_id": ""
    }
  };

  const expectExitCode = 0;
  const tester = new JsonTest();
  await tester.validate('- -f ndjson', input, expectExitCode, expectResult);
});


test(`'echo "<input data>" | abrg - -f geojson' should return the expected results as GEO-JSON format`, async () => {

  const input = trimLines(`東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階`);

  const expectResult = {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": [
            139.736394597,
            35.679107172
          ]
        },
        "properties": {
          "query": {
            "input": "東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階"
          },
          "result": {
            "output": "東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階",
            "match_level": 8,
            "prefecture": "東京都",
            "city": "千代田区",
            "town": "紀尾井町",
            "town_id": "0056000",
            "lg_code": "131016",
            "other": "東京ガーデンテラス紀尾井町 19階、20階",
            "block": "1",
            "block_id": "001",
            "addr1": "3",
            "addr1_id": "003",
            "addr2": "",
            "addr2_id": ""
          }
        }
      }
    ]
  };

  const expectExitCode = 0;
  const tester = new JsonTest();
  await tester.validate('- -f geojson', input, expectExitCode, expectResult);
});

test(`'echo "<input data>" | abrg - -f ndgeojson' should return the expected results as GEO-JSON format on each line`, async () => {

  const input = trimLines(`東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階`);

  const expectResult = {
    "type": "Feature",
    "geometry": {
      "type": "Point",
      "coordinates": [
        139.736394597,
        35.679107172
      ]
    },
    "properties": {
      "query": {
        "input": "東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階"
      },
      "result": {
        "output": "東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階",
        "match_level": 8,
        "prefecture": "東京都",
        "city": "千代田区",
        "town": "紀尾井町",
        "town_id": "0056000",
        "lg_code": "131016",
        "other": "東京ガーデンテラス紀尾井町 19階、20階",
        "block": "1",
        "block_id": "001",
        "addr1": "3",
        "addr1_id": "003",
        "addr2": "",
        "addr2_id": ""
      }
    }
  };

  const expectExitCode = 0;
  const tester = new JsonTest();
  await tester.validate('- -f ndgeojson', input, expectExitCode, expectResult);
});

test.run();