import { Socket } from "net";
import { EventEmitter } from "stream";

import type { Any } from "ts-toolbelt";
import { v4 as uuidv4 } from "uuid";

import type { TestStateManagerRequest, TestStateManagerResponse } from "./api";
import type { TEST_STATE_MANAGER_REQUEST_TAG } from "./api";
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
  private closing = false;
  constructor(private readonly sockPath: string) {
    super();
    this._sock = new Socket();
    this.inFlightRequests = new Map();
  }

  async connect(): Promise<void> {
    await new Promise((resolve) => {
      this._sock.connect(this.sockPath);
      this._sock.once("ready", () => resolve(void 0));
    });
    this._sock.setNoDelay(true);
    this._sock.setKeepAlive(true, 100);

    this._sock.on("error", async (err: Error) => {
      this.emit("error", err);
    });
    this._sock.on("close", async (err: Error) => {
      if (!this.closing) {
        this.emit("close", err);
      }
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
    timeoutMs = 5000,
  ): Promise<Extract<TestStateManagerResponse, { requestTag: T }>["response"]> {
    if (!this._sock.writable) throw new Error("Socket not writable");
    if (this._sock.connecting) throw new Error("Socket not connected");
    let timeout: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise((resolve) => {
      timeout = setTimeout(() => {
        timeout = null;
        resolve(void 0);
      }, timeoutMs);
    });
    const requestId = uuidv4();
    const req =
      JSON.stringify({ request, requestTag, requestId } as TestStateManagerRequest) + "\n";
    const requestPromise = new Promise<
      Extract<TestStateManagerResponse, { requestTag: T }>["response"]
    >((resolve, reject) => {
      this.inFlightRequests.set(requestId, {
        requestId,
        reject,
        resolve,
      });
      if (!this._sock.write(req)) {
        reject(new Error("Socket write failed"));
      }
    });
    const res = (await Promise.race([requestPromise, timeoutPromise])) as any;
    if (timeout) clearTimeout(timeout);
    else {
      throw new Error(`Request ${req} timed out`);
    }
    return res;
  }

  async close() {
    this.closing = true;
    this._sock.end();
  }
}
