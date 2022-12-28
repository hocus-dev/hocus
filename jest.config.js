require("@remix-run/node").installGlobals();

/** @type {import('jest').Config} */
var config = {
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  testEnvironment: "node",
};

module.exports = config;
