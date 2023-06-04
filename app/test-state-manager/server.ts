/* eslint-disable no-console */
import fs from "fs/promises";
import type { Socket } from "node:net";
import { Server } from "node:net";

import { v4 as uuidv4 } from "uuid";

import type { TestStateManagerRequest, TestStateManagerResponse } from "./api";
import { TestStateManagerRequestValidator, TEST_STATE_MANAGER_REQUEST_TAG } from "./api";

import { waitForPromises } from "~/utils.shared";

const srv = new Server();
// Each connection manages multiple tests
// Each test has a stack of cleanup closures
// socketId => runId => TestRunStateT
type TestRunStateT = {
  socketId: string;
  runId: string;
  cleanupClosures: ((failed: boolean) => Promise<void>)[];
};
type SocketStateT = { sock: Socket; tests: Map<string, TestRunStateT> };
const srvState = new Map<string, SocketStateT>();

const cleanupTestRun = async (testState: TestRunStateT, testFailed: boolean) => {
  // TODO: fork the process here to ensure a rouge cleanup function won't bring the manager down
  console.log(`Cleaning up test ${testState.runId} on socket ${testState.socketId}`);
  for (const closure of testState.cleanupClosures.reverse()) {
    try {
      await closure(testFailed);
    } catch (err) {
      console.error(testState.socketId, testState.runId, err);
    }
  }
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

  console.log("Waiting for server to terminate");
  await serverClose;
};

const sockPath = "/tmp/test-state-manager.sock";
srv.listen(sockPath, async () => {
  console.log("Listening on Unix socket");
  // Disable the OOM reaper for us ;)
  console.log("Disabling OOM for us");
  try {
    await fs.writeFile("/proc/self/oom_score_adj", "-1000");
  } catch (err) {
    console.error(err);
    console.log("Failed to disable OOM, please run as root");
  }
  srv.on("connection", (sock: Socket) => {
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
      let parsed: unknown;
      // First parse json
      try {
        parsed = JSON.parse(str);
      } catch (err: any) {
        sock.write(
          JSON.stringify({
            requestId: void 0,
            error: err.toString(),
          } as TestStateManagerResponse) + "\n",
        );
        // Nuke the connection cause the client is broken
        sock.end();
        return;
      }
      const sendErrResponse = (err: any) => {
        sock.write(
          JSON.stringify({
            requestId: (parsed as any).requestId,
            error: err.toString(),
          } as TestStateManagerResponse) + "\n",
        );
      };
      // Then validate the schema
      let msg: TestStateManagerRequest;
      try {
        const parseResult = TestStateManagerRequestValidator.SafeParse(parsed);
        if (!parseResult.success) throw parseResult.error;
        msg = parseResult.value;
      } catch (err: any) {
        sendErrResponse(err);
        return;
      }
      // Now handle the message
      const sendOkResponse = <TagT extends TEST_STATE_MANAGER_REQUEST_TAG, ResT>(
        requestTag: TagT,
        response: ResT,
      ) => {
        sock.write(
          JSON.stringify({
            requestId: msg.requestId,
            requestTag,
            response,
          } as TestStateManagerResponse) + "\n",
        );
      };
      try {
        switch (msg.requestTag) {
          case TEST_STATE_MANAGER_REQUEST_TAG.START_TEST:
            console.log(`Starting test with id ${msg.request.runId} on socket ${socketId}`);
            socketState.tests.set(msg.request.runId, {
              cleanupClosures: [],
              socketId,
              runId: msg.request.runId,
            });
            sendOkResponse(TEST_STATE_MANAGER_REQUEST_TAG.START_TEST, {});
            return;
          case TEST_STATE_MANAGER_REQUEST_TAG.END_TEST:
            console.log(`Ending test with id ${msg.request.runId} on socket ${socketId}`);
            const testState = socketState.tests.get(msg.request.runId);
            if (testState === void 0) {
              throw new Error("Unable to find test state");
            }
            socketState.tests.delete(msg.request.runId);
            await cleanupTestRun(testState, msg.request.testFailed);
            sendOkResponse(TEST_STATE_MANAGER_REQUEST_TAG.END_TEST, {});
            return;
        }
      } catch (err: any) {
        sendErrResponse(err);
      }
    });
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
