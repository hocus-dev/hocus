require("@remix-run/node").installGlobals();

/** @type {import('jest').Config} */
var config = {
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  moduleNameMapper: {
    "^~/(.*)$": "<rootDir>/app/$1",
    // https://github.com/remix-run/remix/issues/3105
    "^source-map-support$": "<rootDir>/app/jest/source-map-support.stub.ts",
  },
  testEnvironment: "node",
  collectCoverage: false,
  //workerThreads: true,
  setupFilesAfterEnv: ["<rootDir>/app/jest/test-setup.ts"],
};

module.exports = config;
