import { Socket } from "net";
import { EventEmitter } from "stream";

import type { Any } from "ts-toolbelt";
import { v4 as uuidv4 } from "uuid";

import type { TestStateManagerRequest, TestStateManagerResponse } from "./api";
import { TEST_STATE_MANAGER_REQUEST_TAG } from "./api";
import { TestStateManagerResponseValidator } from "./api";

export class TestStateManager extends EventEmitter {
  private inFlightRequests: Map<
    string,
    {
      resolve: (response: any) => void;
      reject: (error: any) => void;
      requestId: string;
    }
  >;
  private _sock: Socket;
  constructor(private readonly sockPath: string) {
    super();
    this._sock = new Socket();
    this.inFlightRequests = new Map();
  }

  async connect(): Promise<void> {
    await new Promise((resolve) => {
      this._sock.connect(this.sockPath, () => resolve(void 0));
    });
    this._sock.on("data", async (buf: Buffer) => {
      const str = buf.toString("utf-8");
      for (const chunk of str.split("\n")) {
        if (chunk.trim().length === 0) continue;

        let parsed: unknown;
        // First parse json
        try {
          parsed = JSON.parse(chunk);
        } catch (err: any) {
          this.emit("error", err);
          return;
        }
        // Then validate the schema
        let msg: TestStateManagerResponse;
        try {
          const parseResult = TestStateManagerResponseValidator.SafeParse(parsed);
          if (!parseResult.success) throw parseResult.error;
          msg = parseResult.value;
        } catch (err: any) {
          this.emit("error", err);
          return;
        }
        if (msg.requestId === void 0) {
          if ("error" in msg) {
            this.emit("error", msg.error);
          } else {
            this.emit("error", new Error("Malformed response, no error and no requestId"));
          }
          return;
        }
        const handler = this.inFlightRequests.get(msg.requestId);
        if (handler === void 0) {
          this.emit("error", new Error(`No handler for message ${str}`));
          return;
        }
        if ("error" in msg) {
          handler.reject(msg.error);
        } else {
          handler.resolve(msg.response);
        }
      }
    });
  }

  async mkRequest<T extends TEST_STATE_MANAGER_REQUEST_TAG>(
    requestTag: T,
    request: Any.Compute<Extract<TestStateManagerRequest, { requestTag: T }>["request"]>,
  ): Promise<Any.Compute<Extract<TestStateManagerResponse, { requestTag: T }>>> {
    const requestId = uuidv4();
    this._sock.write(
      JSON.stringify({ request, requestTag, requestId } as TestStateManagerRequest) + "\n",
    );
    const requestPromise = new Promise<
      Any.Compute<Extract<TestStateManagerResponse, { requestTag: T }>>
    >((resolve, reject) => {
      this.inFlightRequests.set(requestId, {
        requestId,
        reject,
        resolve,
      });
    });
    return await requestPromise;
  }

  async close() {
    this._sock.end();
  }
}

const main = async () => {
  const sockPath = "/tmp/test-state-manager.sock";
  const test = new TestStateManager(sockPath);
  await test.connect();
  const runId = uuidv4();
  await test.mkRequest(TEST_STATE_MANAGER_REQUEST_TAG.START_TEST, { runId });
  await test.mkRequest(TEST_STATE_MANAGER_REQUEST_TAG.END_TEST, { runId, testFailed: false });
  await test.close();
};

void main();
