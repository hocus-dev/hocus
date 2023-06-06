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
  setupFilesAfterEnv: ["<rootDir>/app/jest/test-setup.ts"],
};

module.exports = config;
