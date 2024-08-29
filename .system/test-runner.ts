import { $ } from 'execa-cjs';
import path from 'node:path';
const packageJsonPath = path.normalize(path.join(__dirname, '..', 'package.json'));
const rootDir = path.dirname(packageJsonPath);
const dbPath = path.join(rootDir, 'db');
const cliPath = path.join(rootDir, 'build', 'interface', 'cli', 'cli.js');

const lgCodes = [
  '131016', // 東京都千代田区

  // issue #166
  '033812', // 岩手県胆沢郡金ケ崎町
  '082082', // 茨城県龍ケ崎市
  '122246', // 千葉県鎌ケ谷市
  '122297', // 千葉県袖ケ浦市
  '213624', // 岐阜県不破郡関ケ原

  // issue #133
  '183229', // 福井県永平寺町
  '182052', // 福井県大野市
  '032140', // 岩手県八幡平市

  // issue #157
  '011011', // 北海道札幌市
];

$({ stdout: 'inherit', stderr: 'inherit' })`npm run build`
  .then(() => {
    return $({ stdout: 'inherit', stderr: 'inherit' })`npx rimraf ${dbPath}`
  })
  .then(() => {
    return $({ stdout: 'inherit', stderr: 'inherit' })`node ${cliPath} download -c ${lgCodes.join(' ')} -d ${dbPath}`
  })
  .then(() => {
    $({ stdout: 'inherit', stderr: 'inherit' })`npx jest --config ${rootDir}/jest.system-test.config.js`
  })