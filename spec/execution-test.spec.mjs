const trimLines = (target) => {
  return target.replace(/^\s*(.*?)\s*$/gm, '$1');
};

const { $ } = await import('zx');
const csvtojson = (await import('csvtojson')).default;
const path = await import('path');
const { fileURLToPath } = await import('url');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { test } = await import('uvu');
const assert = await import('uvu/assert');
const jsonDiff = (await import('json-diff')).default;

$.cwd = __dirname;

class Test {

  async execute(args, input) {
    const p = $`node ../build/index.js ${args} --dataDir ./ --resource demo`.quiet().stdio('pipe');
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

    if (result) {
      assert.equal(result.exitCode, expectCode, `The exit code should be ${expectCode}`);
      const diffResult = jsonDiff.diffString(
        JSON.parse(trimLines(result.stdout)),
        expectOutput,
      )
      assert.equal(diffResult, '')
    }
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

    if (result) {
      assert.equal(result.exitCode, expectCode, `The exit code should be ${expectCode}`);

      const results = await csvtojson({
        output: 'csv',
      }).fromString(trimLines(result.stdout));
      const expectCsv = await csvtojson({
        output: 'csv',
      }).fromString(trimLines(expectOutput));

      const diffResult = jsonDiff.diffString(
        results,
        expectCsv,
      )
      assert.equal(diffResult, '')
    }
  }
}

test.before(async () => {
  $`rm -f demo.sqlite`.quiet();
  const result = await $`sqlite3 demo.sqlite < demo.sql`.quiet();
  assert.equal(result.exitCode, 0, `The exit code should be 0`);
})

test('test: 標準入力を指定した場合', async () => {

  const input = `
  //
  // サンプルデータ ('#' または // で始まる行はコメント行として処理します)
  //
  東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 16階、19階、20階
  東京都千代田区九段南1丁目2-1
  `;

  const expectResult = `
    input, match_level, lg_code, prefecture, city, town, block, addr1, addr2, other, lat, lon
    "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 16階、19階、20階",8,131016,東京都,千代田区,紀尾井町,1,3,, 東京ガーデンテラス紀尾井町 16階、19階、20階,35.679107172,139.736394597
    "東京都千代田区九段南1丁目2-1",3,131016,東京都,千代田区,九段南一丁目,,,,,35.693972,139.753265
  `;

  const expectExitCode = 0;
  const tester = new CsvTest();
  await tester.validate('- -f csv', input, expectExitCode, expectResult)
})



test('test: 無効な値を指定した場合', async () => {

  const input = `東京都千代田区紀尾井町1-3`;

  const expectResult = `[error] Can not open the source file`;

  const expectExitCode = 1;
  const tester = new CsvTest();
  await tester.validate('brabrabra -f csv', input, expectExitCode, expectResult);
})

test('test: jsonが出力されるはず', async () => {

  const input = `東京都千代田区紀尾井町1-3`;

  const expectResult = [
    {
      "query": { "input": "東京都千代田区紀尾井町1-3" },
      "result": {
        "prefecture": "東京都",
        "match_level": 8,
        "city": "千代田区",
        "town": "紀尾井町",
        "town_id": "0056000",
        "lg_code": "131016",
        "other": "",
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

test('test: ndjsonが出力されるはず', async () => {

  const input = `東京都千代田区紀尾井町1-3`;

  const expectResult = {
    "query": {
      "input": "東京都千代田区紀尾井町1-3",
    },
    "result": {
      "prefecture": "東京都",
      "match_level": 8,
      "city": "千代田区",
      "town": "紀尾井町",
      "town_id": "0056000",
      "lg_code": "131016",
      "other": "",
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


test('test: geojsonが出力されるはず', async () => {

  const input = trimLines(`東京都千代田区紀尾井町1-3`);

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
            "input": "東京都千代田区紀尾井町1-3"
          },
          "result": {
            "match_level": 8,
            "prefecture": "東京都",
            "city": "千代田区",
            "town": "紀尾井町",
            "town_id": "0056000",
            "lg_code": "131016",
            "other": "",
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

test('test: ndgeojsonが出力されるはず', async () => {

  const input = trimLines(`東京都千代田区紀尾井町1-3`);

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
        "input": "東京都千代田区紀尾井町1-3"
      },
      "result": {
        "match_level": 8,
        "prefecture": "東京都",
        "city": "千代田区",
        "town": "紀尾井町",
        "town_id": "0056000",
        "lg_code": "131016",
        "other": "",
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


test.after(async () => {
  $`rm -f demo.sqlite`.quiet();
})

test.run();