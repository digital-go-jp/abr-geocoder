/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ["js", "ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        "tsconfig": "tsconfig.spec.json"
      }
    ]
  },
  moduleDirectories: [
    "node_modules",
    "src",
    "settings",
    "__mocks__",
  ],
  moduleNameMapper: {
    'node:fs': '<rootDir>/__mocks__/fs.ts',
  },
  roots: ['<rootDir>/src/','<rootDir>/__mocks__'],
  testRegex: './src/.*\\.(test|spec)?\\.ts$',
  testPathIgnorePatterns: [
    "lib/", 
    "build/",
    "node_modules/", 
  ],
  collectCoverage: true,
  reporters: ['default', ['jest-junit', { outputDirectory: 'coverage' }]],
  coverageReporters: ['clover', 'json', 'lcov', ['text', { file: 'coverage.txt' }], 'json-summary']
};