/* eslint-disable no-console */
import fs from "fs/promises";
import type { Socket } from "node:net";
import { Server } from "node:net";
import { basename, dirname, join } from "path";

import { DefaultLogger } from "@temporalio/worker";
import { v4 as uuidv4 } from "uuid";

import type { TestStateManagerRequest, TestStateManagerResponse } from "./api";
import { TestStateManagerRequestValidator, TEST_STATE_MANAGER_REQUEST_TAG } from "./api";
import { onServerExit as dbOnServerExit, setupTestDatabase } from "./db";

import { BlockRegistryService } from "~/agent/block-registry/registry.service";
import { execCmd, execCmdWithOpts } from "~/agent/utils";
import { waitForPromises } from "~/utils.shared";

const testsDir = process.env.TEST_STORAGE_DIR;
if (testsDir === void 0) {
  throw new Error(`Please specify TEST_STORAGE_DIR`);
}
const sockPath = join(testsDir, "state_manager.sock");

console.log(`Will listen on ${sockPath} and manage ${testsDir}`);

const pathRemap = (from: string, to: string, path: string): string => {
  if (!from.endsWith("/")) from = from + "/";
  if (!to.endsWith("/")) to = to + "/";
  return path.replace(from, to);
};

const srv = new Server({ noDelay: true, keepAlive: true, pauseOnConnect: true });
// Each connection manages multiple tests
// Each test has a stack of cleanup closures
// socketId => runId => TestRunStateT
type TestRunStateT = {
  socketId: string;
  runId: string;
  // In case of failure this directory will be uploaded
  // This is the path accessible from where the server is running and not necessarily accessible for the test
  getTestStateDir: () => Promise<string>;
  // Path where testsDir is mounted in the test container
  testsDirMountPath: string;
  cleanupClosures: ((debugDumpDir: string | null) => Promise<void>)[];
};
type SocketStateT = { sock: Socket; tests: Map<string, TestRunStateT> };
const srvState = new Map<string, SocketStateT>();

const artifactsUploadPromises: Map<string, Promise<void>> = new Map();
const cleanupTestRun = async (
  testState: TestRunStateT,
  testFailed: boolean,
): Promise<string | undefined> => {
  console.log(`Cleaning up test ${testState.runId} on socket ${testState.socketId}`);
  for (const closure of testState.cleanupClosures.reverse()) {
    try {
      // If test failed then request a debug dump
      await closure(testFailed ? await testState.getTestStateDir() : null);
    } catch (err) {
      console.error(testState.socketId, testState.runId, err);
    }
  }
  const redFG = "\x1b[31m";
  const resetFG = "\x1b[0m";
  let keepStorage = false;
  let artifactsMsg: string | undefined = void 0;
  if (testFailed) {
    // Keep storage until we make a tarball
    keepStorage = true;
    if (process.env["BUILDKITE_AGENT_ACCESS_TOKEN"] !== void 0) {
      const testRunDir = await testState.getTestStateDir();
      const archivePath = testRunDir + ".tar.gz";
      // Don't block the response for the client
      // Do the upload in the background
      const taskKey = uuidv4();
      artifactsUploadPromises.set(
        taskKey,
        (async () => {
          await execCmd(
            "tar",
            "--hole-detection=seek",
            "--sparse",
            "-zcf",
            archivePath,
            "-C",
            dirname(archivePath),
            basename(testRunDir),
          );
          await fs.rm(testRunDir, { recursive: true, force: true });
          try {
            await execCmdWithOpts(
              ["buildkite-agent", "artifact", "upload", basename(archivePath)],
              {
                cwd: dirname(archivePath),
              },
            );
          } finally {
            await fs.unlink(archivePath);
          }
          artifactsUploadPromises.delete(taskKey);
        })(),
      );
      artifactsMsg = `${redFG}Failed run id: ${testState.runId}. Please consult the artifact ${testState.runId}.tar.gz${resetFG}`;
    } else {
      const testRunDir = await testState.getTestStateDir();
      artifactsMsg = `${redFG}Failed run id: ${testState.runId}. Please investigate ${testRunDir}${resetFG}`;
    }
  }
  if (artifactsMsg) console.error(artifactsMsg);
  if (!keepStorage) {
    await fs.rm(await testState.getTestStateDir(), { recursive: true, force: true });
  }
  return artifactsMsg;
};

const cleanupConnection = async (socketState: SocketStateT) => {
  socketState.sock.destroy();
  // Fail all tests still alive on this socket
  await waitForPromises(
    Array.from(socketState.tests, async ([runId, testState]) => {
      socketState.tests.delete(runId);
      // Assume tests failed!
      await cleanupTestRun(testState, true);
    }),
  );
};

let serverTerminationInProgress = false;
const cleanupServer = async () => {
  if (serverTerminationInProgress) return;
  serverTerminationInProgress = true;
  console.log("Closing server");
  const serverClose = new Promise((resolve, reject) =>
    srv.close((err) => (err ? reject(err) : resolve(void 0))),
  );
  console.log("Cleaning up server state");
  // Fail all tests still alive
  await waitForPromises(
    Array.from(srvState, async ([socketId, socketState]) => {
      srvState.delete(socketId);
      await cleanupConnection(socketState);
    }),
  );

  await waitForPromises(artifactsUploadPromises.values());

  await dbOnServerExit();

  console.log("Waiting for server to terminate");
  await serverClose;
};

const processRequest = async (
  msg: TestStateManagerRequest,
  socketId: string,
  socketState: SocketStateT,
) => {
  const sendOkResponse = <TagT extends TEST_STATE_MANAGER_REQUEST_TAG>(
    requestTag: TagT,
    response: Extract<TestStateManagerResponse, { requestTag: TagT }>["response"],
  ) => {
    if (
      !socketState.sock.write(
        JSON.stringify({
          requestId: msg.requestId,
          requestTag,
          response,
        } as TestStateManagerResponse) + "\n",
      )
    ) {
      console.error("Failed writing to socket");
    }
  };

  switch (msg.requestTag) {
    case TEST_STATE_MANAGER_REQUEST_TAG.TEST_START:
      console.log(`Starting test with id ${msg.request.runId} on socket ${socketId}`);
      let testStateDirSetup: Promise<string> | null = null;
      socketState.tests.set(msg.request.runId, {
        cleanupClosures: [],
        socketId,
        runId: msg.request.runId,
        testsDirMountPath: msg.request.testsDirMountPath,
        getTestStateDir: async (): Promise<string> => {
          if (testStateDirSetup === null) {
            testStateDirSetup = (async () => {
              const testStateDir = join(testsDir, msg.request.runId);
              await fs.mkdir(testStateDir, { recursive: true, mode: 0o777 });
              await fs.chmod(testStateDir, 0o777);
              return testStateDir;
            })();
          }
          return await testStateDirSetup;
        },
      });
      sendOkResponse(TEST_STATE_MANAGER_REQUEST_TAG.TEST_START, {});
      return;
    case TEST_STATE_MANAGER_REQUEST_TAG.TEST_END:
      {
        console.log(`Ending test with id ${msg.request.runId} on socket ${socketId}`);
        const testState = socketState.tests.get(msg.request.runId);
        if (testState === void 0) {
          throw new Error("Unable to find test state");
        }
        socketState.tests.delete(msg.request.runId);
        const artifactsMsg = await cleanupTestRun(testState, msg.request.testFailed);
        sendOkResponse(TEST_STATE_MANAGER_REQUEST_TAG.TEST_END, { artifactsMsg });
      }
      return;
    case TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_LOGS_FILE:
      {
        console.log(`Requesting logs file with id ${msg.request.runId} on socket ${socketId}`);
        const testState = socketState.tests.get(msg.request.runId);
        if (testState === void 0) {
          throw new Error("Unable to find test state");
        }
        // No advanced cleanup required
        const testStateDir = await testState.getTestStateDir();
        sendOkResponse(TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_LOGS_FILE, {
          path: pathRemap(
            testsDir,
            testState.testsDirMountPath,
            join(testStateDir, `logger-${uuidv4()}.log`),
          ),
        });
      }
      return;
    case TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_DATABASE:
      {
        console.log(
          `Requesting new database from ${msg.request.prismaSchemaPath} on test ${msg.request.runId} on socket ${socketId}`,
        );
        const testState = socketState.tests.get(msg.request.runId);
        if (testState === void 0) {
          throw new Error("Unable to find test state");
        }
        sendOkResponse(TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_DATABASE, {
          dbName: await setupTestDatabase(msg.request.prismaSchemaPath, testState.cleanupClosures),
        });
      }
      return;
    case TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_TEST_STATE_DIR:
      {
        const testState = socketState.tests.get(msg.request.runId);
        if (testState === void 0) {
          throw new Error("Unable to find test state");
        }
        sendOkResponse(TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_TEST_STATE_DIR, {
          dirPath: pathRemap(
            testsDir,
            testState.testsDirMountPath,
            await testState.getTestStateDir(),
          ),
        });
      }
      return;
    case TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_BLOCK_REGISTRY_WATCH:
      {
        const testState = socketState.tests.get(msg.request.runId);
        if (testState === void 0) {
          throw new Error("Unable to find test state");
        }
        testState.cleanupClosures.push(async () => {
          const brService = new BlockRegistryService(new DefaultLogger("ERROR"), {
            agent: () => ({
              blockRegistryRoot: pathRemap(
                testState.testsDirMountPath,
                testsDir,
                msg.request.blockRegistryDir,
              ),
              blockRegistryConfigFsPath: "/sys/kernel/config",
            }),
          } as any);
          await brService.hideEverything();
        });
        sendOkResponse(TEST_STATE_MANAGER_REQUEST_TAG.REQUEST_BLOCK_REGISTRY_WATCH, {});
      }
      return;
  }
};

srv.listen(sockPath, async () => {
  // Allow anyone to connect to us :)
  await fs.mkdir(testsDir, { recursive: true, mode: 0o777 });
  try {
    await fs.chmod(testsDir, 0o777);
  } catch (err) {
    console.log("Failed to chmod test dir. Proceeding anyway");
  }
  await fs.chmod(sockPath, 0o777);
  console.log(`Listening on Unix socket ${sockPath}`);
  // Disable the OOM reaper for us ;)
  console.log("Disabling OOM for us");
  try {
    await fs.writeFile("/proc/self/oom_score_adj", "-1000");
  } catch (err) {
    console.error(err);
    console.log("Failed to disable OOM, please run as root");
  }
  srv.on("connection", (sock: Socket) => {
    sock.setNoDelay(true);
    sock.setKeepAlive(true, 100);
    const socketId = uuidv4();
    console.log(`Got connection with ID: ${socketId}`);
    const socketState: SocketStateT = { sock, tests: new Map() };
    srvState.set(socketId, socketState);
    sock.on("close", async () => {
      console.log(`Connection closed with ID: ${socketId}`);
      srvState.delete(socketId);
      await cleanupConnection(socketState);
    });
    sock.on("error", async (err) => {
      console.error(socketId, "Socket error", err);
      console.log(`Connection closed with ID: ${socketId}`);
      srvState.delete(socketId);
      await cleanupConnection(socketState);
    });
    sock.on("data", async (buf: Buffer) => {
      const str = buf.toString("utf-8");
      const tasks = [];
      for (const chunk of str.split("\n")) {
        if (chunk.trim().length === 0) continue;

        let parsed: unknown;
        // First parse json
        try {
          parsed = JSON.parse(chunk);
        } catch (err: any) {
          console.error(`${socketId} Sending err ${err}`);
          if (
            !sock.write(
              JSON.stringify({
                requestId: void 0,
                error: err.toString(),
              } as TestStateManagerResponse) + "\n",
            )
          ) {
            console.error("Failed writing to socket");
          }
          // Nuke the connection cause the client is broken
          sock.end();
          // We nuked the connection so we don't care about the remaining messages
          return;
        }
        const sendErrResponse = (err: any) => {
          console.error(`${socketId} Sending err ${err}`);
          if (
            !sock.write(
              JSON.stringify({
                requestId: (parsed as any).requestId,
                error: err.toString(),
              } as TestStateManagerResponse) + "\n",
            )
          ) {
            console.error("Failed writing to socket");
          }
        };
        // Then validate the schema
        let msg: TestStateManagerRequest;
        try {
          const parseResult = TestStateManagerRequestValidator.SafeParse(parsed);
          if (!parseResult.success) throw parseResult.error;
          msg = parseResult.value;
        } catch (err: any) {
          console.error(`${socketId} Sending err ${err}`);
          sendErrResponse(err);
          continue;
        }
        console.log(`Got request ${msg.requestId} on socket ${socketId}`);
        // Now handle the message
        tasks.push(async () => {
          try {
            await processRequest(msg, socketId, socketState);
          } catch (err: any) {
            console.error(`${socketId} Sending err ${err}`);
            sendErrResponse(err);
          }
        });
      }
      await waitForPromises(tasks.map((task) => task()));
    });
    sock.resume();
  });
});

// Try to be as resilient as possible
process.on("exit", cleanupServer);
process.on("beforeExit", cleanupServer);
process.on("uncaughtException", async (err) => {
  console.error("Got uncaught exception", err);
  await cleanupServer();
});
process.on("unhandledRejection", async (err) => {
  console.error("Got unhandled rejection", err);
  await cleanupServer();
});
process.on("SIGINT", cleanupServer);
process.on("SIGTERM", cleanupServer);
process.on("SIGHUP", cleanupServer);
process.on("SIGUSR2", cleanupServer);
