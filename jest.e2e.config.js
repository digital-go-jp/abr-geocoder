const { compilerOptions } = require('./tsconfig.json')
const { pathsToModuleNameMapper } = require('ts-jest')

const roots = ['<rootDir>/src', '<rootDir>/e2e'];
const moduleDirectories = [
  "node_modules/",
  "src",
];
const tsconfig = "./tsconfig.e2e.json";
process.env.USE_CLI = 'true';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
  moduleFileExtensions: ["js", "ts"],
  transform: {
    "^.+\\.ts$": [ "ts-jest", {
      "tsconfig": tsconfig,
    }]
  },
  moduleDirectories,
  modulePaths: [compilerOptions.baseUrl],
  moduleNameMapper: {
    // 'node:fs': '<rootDir>/__mocks__/fs.ts',
    // 'node:os': '<rootDir>/__mocks__/os.ts',
    // 'better-sqlite3': '<rootDir>/__mocks__/better-sqlite3.ts',
    // 'csv-parser': '<rootDir>/__mocks__/csv-parser.ts',
    // '^(\\.{1,2}/.*)\\.js$': '$1',  // JavaScriptファイルの拡張子を補完
    ...pathsToModuleNameMapper(compilerOptions.paths),
  },
  // テストファイルの場所
  roots,
  // transformIgnorePatterns: [
  //   // esmが使われているパッケージを除いてIgnoreする
  //   // `node_modules/(?!(${esmPackages.join("|")})/)`,
  // ],
  testRegex: 'e2e/__tests__/.*\\.(test|spec)?\\.ts$',
  testPathIgnorePatterns: [
    "lib/", 
    "build/",
    "node_modules/", 
    "\\.skip\\.ts$",
    "debug.test.ts",
  ],

  // タイムアウト: 5分
  // (ダウンロードをするので時間がかかる可能性がある)
  testTimeout: 5 * 60 * 1000, 

  // キャッシュファイルを作成する関係で、ファイルを1つずつテストする
  maxConcurrency: 1,
};
