require("@remix-run/node").installGlobals();

/** @type {import('jest').Config} */
var config = {
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  moduleNameMapper: {
    "^~/(.*)$": "<rootDir>/app/$1",
  },
  testEnvironment: "node",
};

module.exports = config;
