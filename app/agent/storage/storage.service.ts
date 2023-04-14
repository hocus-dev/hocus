import fs from "fs/promises";
import os from "os";
import path from "path";

import yaml from "yaml";

import { withFileLock } from "../utils";

import type { AgentStorage } from "./storage.validator";
import { AgentStorageValidator } from "./storage.validator";

import { Token } from "~/token";

/**
 * The low level storage service is responsible for reading and writing the agent's storage file.
 *
 * It should not be constructed directly, instead use `StorageService`. This
 * ensures that the storage file is locked while it is being read or written.
 */
export class LowLevelStorageService {
  async createEmptyStorageFile(): Promise<void> {
    const pathToStorage = this.getPathToStorage();
    await fs.mkdir(path.dirname(pathToStorage), { recursive: true });
    await fs.writeFile(pathToStorage, "", { flag: "a" });
  }

  getPathToStorage(): string {
    return path.join(os.homedir(), ".hocus.yml");
  }

  async readStorage(): Promise<AgentStorage> {
    const raw = await fs.readFile(this.getPathToStorage(), "utf8");
    if (raw === "") {
      return {
        agentId: "solo-agent",
        busyIpBlockIds: [],
      };
    }
    return AgentStorageValidator.Parse(yaml.parse(raw));
  }

  async writeStorage(storage: AgentStorage): Promise<void> {
    AgentStorageValidator.Parse(storage);
    const raw = yaml.stringify(storage);
    await fs.writeFile(this.getPathToStorage(), raw, "utf8");
  }
}

export class StorageService {
  static inject = [Token.LowLevelStorageService] as const;
  constructor(private readonly lowLevelStorageService: LowLevelStorageService) {}

  async withStorage<T>(fn: (storage: LowLevelStorageService) => Promise<T>): Promise<T> {
    await this.lowLevelStorageService.createEmptyStorageFile();
    return await withFileLock(this.lowLevelStorageService.getPathToStorage(), async () => {
      return await fn(this.lowLevelStorageService);
    });
  }
}
