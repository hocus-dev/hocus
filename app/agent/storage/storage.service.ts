import { existsSync } from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";

import lockfile from "proper-lockfile";
import yaml from "yaml";

import type { AgentStorage } from "./storage.validator";
import { AgentStorageValidator } from "./storage.validator";

/**
 * The lowlevel storage service is responsible for reading and writing the agent's storage file.
 *
 * It should not be constructed directly, instead use `StorageService`. This
 * ensures that the storage file is locked while it is being read or written.
 */
export class LowLevelStorageService {
  getPathToStorage(): string {
    return path.join(os.homedir(), ".hocus.yml");
  }

  async readStorage(): Promise<AgentStorage> {
    if (!existsSync(this.getPathToStorage())) {
      return {
        busyIpIds: [],
      };
    }
    const raw = await fs.readFile(this.getPathToStorage(), "utf8");
    return AgentStorageValidator.Parse(yaml.parse(raw));
  }

  async writeStorage(storage: AgentStorage): Promise<void> {
    AgentStorageValidator.Parse(storage);
    const raw = yaml.stringify(storage);
    await fs.writeFile(this.getPathToStorage(), raw, "utf8");
  }
}

export class StorageService {
  constructor(private readonly lowLevelStorageService: LowLevelStorageService) {}

  async withStorage<T>(fn: (storage: LowLevelStorageService) => Promise<T>): Promise<T> {
    const release = await lockfile.lock(this.lowLevelStorageService.getPathToStorage());
    try {
      return await fn(this.lowLevelStorageService);
    } finally {
      await release();
    }
  }
}
