/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  "moduleFileExtensions": ["js", "ts"],
  "transform": {
    "^.+\\.ts$": [
      "ts-jest",
      {
        "tsconfig": "tsconfig.spec.json"
      }
    ]
  },
  "moduleDirectories": [
    "node_modules",
    "src",
    "settings"
  ],
  roots: ['./src'],
  testRegex: './src/.*\\.(test|spec)?\\.(ts|ts)$',
  testPathIgnorePatterns: ["/lib/", "/node_modules/"],
  collectCoverage: true,
};