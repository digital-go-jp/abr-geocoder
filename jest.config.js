const { compilerOptions } = require('./tsconfig.json')
const { pathsToModuleNameMapper } = require('ts-jest')
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
  moduleFileExtensions: ["js", "ts"],
  transform: {
    "^.+\\.ts$": [ "ts-jest", {
      "tsconfig": "tsconfig.spec.json"
    }]
  },
  moduleDirectories: [
    "node_modules",
    "src",
    "__mocks__"
  ],
  modulePaths: [compilerOptions.baseUrl],
  moduleNameMapper: {
    // 'node:fs': '<rootDir>/__mocks__/fs.ts',
    // 'node:os': '<rootDir>/__mocks__/os.ts',
    // 'better-sqlite3': '<rootDir>/__mocks__/better-sqlite3.ts',
    // 'csv-parser': '<rootDir>/__mocks__/csv-parser.ts',
    ...pathsToModuleNameMapper(compilerOptions.paths),
  },
  roots: ['<rootDir>/src/', '<rootDir>/__mocks__/'],
  testRegex: './src/.*\\.(test|spec)?\\.ts$',
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
