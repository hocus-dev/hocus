require("@remix-run/node").installGlobals();
/*require("ts-node").register({
  transpileOnly: true,
});*/
require("tsconfig-paths").register();

/** @type {import('jest').Config} */
var config = {
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  moduleNameMapper: {
    "^~/(.*)$": "<rootDir>/app/$1",
  },
  testEnvironment: "node",
  workerThreads: true,
  globalSetup: "<rootDir>/app/jest/global-setup.ts",
  globalTeardown: "<rootDir>/app/jest/global-teardown.ts",
};

module.exports = config;
