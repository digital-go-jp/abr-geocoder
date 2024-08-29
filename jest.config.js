const { compilerOptions } = require('./tsconfig.json')
const { pathsToModuleNameMapper } = require('ts-jest')

const targetTestFile = process.argv[2];
const { roots, moduleDirectories, tsconfig } = (() => {
  const moduleDirectories = [
    "node_modules/",
    "src",
  ];
  const roots = [
    '<rootDir>/src/',
  ];
  let tsconfig = '';

  if (targetTestFile && targetTestFile.includes('.system')) {
    roots.push('<rootDir>/.system/');
    moduleDirectories.push(".system");
    tsconfig = "./tsconfig.system-test.json";
    tsconfig = "./tsconfig.spec.json";
  } else {
    moduleDirectories.push("__mocks__");
    tsconfig = "./tsconfig.spec.json";
  }
  return {
    roots,
    moduleDirectories,
    tsconfig,
  };
})();
module.exports = {
  preset: 'ts-jest',  // ESM用のpresetを指定
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
  testRegex: '.*\\.(test|spec)?\\.ts$',
  testPathIgnorePatterns: [
    "lib/", 
    "build/",
    "node_modules/", 
    "\\.skip\\.ts$",
  ],
  collectCoverage: true,
  reporters: ['default', ['jest-junit', { outputDirectory: 'coverage' }]],
  coverageReporters: ['clover', 'json', 'lcov', ['text', { file: 'coverage.txt' }], 'json-summary']
};
