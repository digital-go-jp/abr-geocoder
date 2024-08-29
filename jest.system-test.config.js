const { compilerOptions } = require('./tsconfig.json')

const roots = ['<rootDir>/src', '<rootDir>/.system'];
const moduleDirectories = [
  "node_modules/",
  "src",
];
const tsconfig = "./tsconfig.system-test.json";

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
  // テストファイルの場所
  roots,
  // transformIgnorePatterns: [
  //   // esmが使われているパッケージを除いてIgnoreする
  //   // `node_modules/(?!(${esmPackages.join("|")})/)`,
  // ],
  testRegex: '.system/__tests__/.*\\.(test|spec)?\\.ts$',
  testPathIgnorePatterns: [
    "lib/", 
    "build/",
    "node_modules/", 
    "\\.skip\\.ts$",
  ],
};
