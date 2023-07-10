// eslint-disable-next-line n/prefer-global/console
import console from "console";
import { dirname } from "path";

import { TestStateManager } from "~/test-state-manager/client";
import { doesFileExist } from "~/utils.server";
// https://github.com/jestjs/jest/issues/10322#issuecomment-1304375267
global.console = console;

// When running agent tests inside docker the stack traces contain
// file names inside the test container. This means that you can't click
// on a file name in a stack trace and get the location opened in vscode.
// Forcefully rewrite the file names to be relative to improve the devex :)
// I love that JS allows me to write this code...
const projectDir = dirname(dirname(__dirname));
const origStackFormatter = Error.prepareStackTrace;
if (origStackFormatter) {
  Error.prepareStackTrace = (err, stackTrace) => {
    return origStackFormatter(err, stackTrace)
      .replaceAll(`at ${projectDir}/`, "at ./")
      .replaceAll(`(${projectDir}/`, "(./");
    // WARNING: messing with the callSites will cause the stack trace to point to wrong code .-.
  };
}

beforeAll(async () => {
  let testStorageDir = process.env.TEST_STORAGE_DIR;
  if (testStorageDir === void 0) {
    if (await doesFileExist("/srv/jailer")) {
      testStorageDir = "/srv/jailer/tests";
    } else if (await doesFileExist("/home/hocus/dev/hocus-resources")) {
      testStorageDir = "/home/hocus/dev/hocus-resources/tests";
    } else {
      throw new Error("Please provide TEST_STORAGE_DIR");
    }
  }
  const stateManager = new TestStateManager(testStorageDir);
  await stateManager.connect();
  stateManager.on("error", (err: Error) => {
    console.error("State manager terminated due to error", err);
    process.kill(process.pid, "SIGINT");
  });
  stateManager.on("close", () => {
    console.error("Connection to state manager terminated");
    process.kill(process.pid, "SIGINT");
  });
  (globalThis as any).stateManager = stateManager;
});

afterAll(async () => {
  await (globalThis as any).stateManager.close();
});
