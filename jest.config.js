const { compilerOptions } = require('./tsconfig.json')
const { pathsToModuleNameMapper } = require('ts-jest')

const targetTestFile = process.argv[2];
const { roots, moduleDirectories } = (() => {
  const moduleDirectories = [
    "node_modules/",
    "src",
  ];
  const roots = [
    '<rootDir>/src/',
  ];

  if (targetTestFile && targetTestFile.includes('e2e')) {
    roots.push('<rootDir>/e2e/');
    moduleDirectories.push("e2e");
  } else {
    moduleDirectories.push("__mocks__");
  }
  return {
    roots,
    moduleDirectories,
  };
})();
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
  moduleFileExtensions: ["js", "ts"],
  transform: {
    "^.+\\.ts$": [ "ts-jest", {
      "tsconfig": "./tsconfig.spec.json",
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
