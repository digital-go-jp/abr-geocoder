const trimLines = (target) => {
  return target.replace(/^\s*(.*?)\s*$/gm, '$1');
};


const main = async () => {
  const { $ } = await import('zx');
  const assert = (await import('node:assert')).default;

  $.cwd = __dirname;

  const test = async (title, args, input, expectCode, expectOutput) => {
    const p = $`node ../build/index.js ${args} --dataDir ./ --resource demo`.quiet().stdio('pipe');
    p.stdin.write(input);
    p.stdin.end();
    const result = await p.catch(e => {
      if (expectCode === e.exitCode) {
        return;
      }
      throw e;
    }) 
    if (result) {
      assert.equal(result.exitCode, expectCode);
      assert.equal(result.stdout.trim(), expectOutput);
    }
    console.log(`✔ ${title}`);
  };
  
  $`rm -f demo.sqlite`.quiet();

  const result = await $`sqlite3 demo.sqlite < demo.sql`.quiet();
  assert.equal(result.exitCode, 0);
  

  await (async () => {

    const input = trimLines(`
    //
    // サンプルデータ ('#' または // で始まる行はコメント行として処理します)
    //
    東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 16階、19階、20階
    東京都千代田区九段南1丁目2-1
    `);

    const expectResult = trimLines(`
      input, match_level, lg_code, prefecture, city, town, block, addr1, addr2, other, lat, lon
      "東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 16階、19階、20階",8,131016,東京都,千代田区,紀尾井町,1,3,, 東京ガーデンテラス紀尾井町 16階、19階、20階,35.679107172,139.736394597
      "東京都千代田区九段南1丁目2-1",3,131016,東京都,千代田区,九段南一丁目,,,,,35.693972,139.753265
    `);
    
    const expectExitCode = 0;
    await test('test: 標準入力を指定した場合', '- -f csv', input, expectExitCode, expectResult);
  })();


  await (async () => {

    const input = trimLines(`東京都千代田区紀尾井町1-3`);

    const expectResult = trimLines(`[error] Can not open the source file`);
    
    const expectExitCode = 1;
    await test('test: 無効な値を指定した場合', 'brabrabra -f csv', input, expectExitCode, expectResult);
  })();


  await (async () => {

    const input = trimLines(`東京都千代田区紀尾井町1-3`);

    const expectResult = trimLines(`[{"query":{"input":"東京都千代田区紀尾井町1-3"},"result":{"prefecture":"東京都","match_level":8,"city":"千代田区","town":"紀尾井町","town_id":"0056000","lg_code":"131016","other":"","lat":35.679107172,"lon":139.736394597,"block":"1","block_id":"001","addr1":"3","addr1_id":"003","addr2":"","addr2_id":""}}]`);
    
    const expectExitCode = 0;
    await test('test: jsonが出力されるはず', '- -f json', input, expectExitCode, expectResult);
  })();

  await (async () => {

    const input = trimLines(`東京都千代田区紀尾井町1-3`);

    const expectResult = trimLines(`{"query":{"input":"東京都千代田区紀尾井町1-3"},"result":{"prefecture":"東京都","match_level":8,"city":"千代田区","town":"紀尾井町","town_id":"0056000","lg_code":"131016","other":"","lat":35.679107172,"lon":139.736394597,"block":"1","block_id":"001","addr1":"3","addr1_id":"003","addr2":"","addr2_id":""}}`);
    
    const expectExitCode = 0;
    await test('test: jsonが出力されるはず', '- -f ndjson', input, expectExitCode, expectResult);
  })();


  await (async () => {

    const input = trimLines(`東京都千代田区紀尾井町1-3`);

    const expectResult = trimLines(`{"type":"FeatureCollection", "features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[139.736394597,35.679107172]},"properties":{"query":{"input":"東京都千代田区紀尾井町1-3"},"result":{"match_level":8,"prefecture":"東京都","city":"千代田区","town":"紀尾井町","town_id":"0056000","lg_code":"131016","other":"","block":"1","block_id":"001","addr1":"3","addr1_id":"003","addr2":"","addr2_id":""}}}]}`);
    
    const expectExitCode = 0;
    await test('test: geojsonが出力されるはず', '- -f geojson', input, expectExitCode, expectResult);
  })();

  await (async () => {

    const input = trimLines(`東京都千代田区紀尾井町1-3`);

    const expectResult = trimLines(`{"type":"Feature","geometry":{"type":"Point","coordinates":[139.736394597,35.679107172]},"properties":{"query":{"input":"東京都千代田区紀尾井町1-3"},"result":{"match_level":8,"prefecture":"東京都","city":"千代田区","town":"紀尾井町","town_id":"0056000","lg_code":"131016","other":"","block":"1","block_id":"001","addr1":"3","addr1_id":"003","addr2":"","addr2_id":""}}}`);
    
    const expectExitCode = 0;
    await test('test: ndgeojsonが出力されるはず', '- -f ndgeojson', input, expectExitCode, expectResult);
  })();

};

main();