module.exports = {
  "moduleFileExtensions": ["js", "ts"],
  "transform": {
    "^.+\\.ts$": [
      "ts-jest",
      {
        "tsconfig": "tsconfig.spec.json"
      }
    ]
  },
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(js|ts)$",
  testPathIgnorePatterns: ["/lib/", "/node_modules/"],
  collectCoverage: true,
};