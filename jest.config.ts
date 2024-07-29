/** @type {import('ts-jest').JestConfigWithTsJest} */
import type { JestConfigWithTsJest } from 'ts-jest'
import { compilerOptions } from './tsconfig.json';
import { pathsToModuleNameMapper } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    "^.+\\.spec\\.ts$": [
      "ts-jest",
      {
        "tsconfig": "tsconfig.spec.json",
        useESM: true,
      }
    ]
  },
  moduleDirectories: [
    "node_modules",
    "src",
    "settings",
    "__mocks__",
  ],
  modulePaths: [compilerOptions.baseUrl],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    'node:fs': '<rootDir>/__mocks__/fs.ts',
    'node:os': '<rootDir>/__mocks__/os.ts',
    'better-sqlite3': '<rootDir>/__mocks__/better-sqlite3.ts',
    'csv-parser': '<rootDir>/__mocks__/csv-parser.ts',
    ...pathsToModuleNameMapper(compilerOptions.paths),
  },
  roots: ['<rootDir>/src/','<rootDir>/__mocks__'],
  testRegex: './src/.*\\.(test|spec)?\\.ts$',
  testPathIgnorePatterns: [
    "lib/", 
    "build/",
    "node_modules/", 
    "**/__skips__/",
  ],
  collectCoverage: true,
  reporters: ['default', ['jest-junit', { outputDirectory: 'coverage' }]],
  coverageReporters: ['clover', 'json', 'lcov', ['text', { file: 'coverage.txt' }], 'json-summary']
};

export default jestConfig;