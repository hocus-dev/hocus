import fs from "fs/promises";
import os from "os";
import path from "path";

import lockfile from "proper-lockfile";
import yaml from "yaml";
import { Token } from "~/token";

import type { AgentStorage } from "./storage.validator";
import { AgentStorageValidator } from "./storage.validator";

/**
 * The lowlevel storage service is responsible for reading and writing the agent's storage file.
 *
 * It should not be constructed directly, instead use `StorageService`. This
 * ensures that the storage file is locked while it is being read or written.
 */
export class LowLevelStorageService {
  private async createEmptyStorageFile(): Promise<void> {
    const pathToStorage = this.getPathToStorage();
    await fs.mkdir(path.dirname(pathToStorage), { recursive: true });
    await fs.writeFile(pathToStorage, "", { flag: "a" });
  }

  private getPathToStorage(): string {
    return path.join(os.homedir(), ".hocus.yml");
  }

  /**
   * Returns a function that releases the lock.
   */
  async lockStorage(): Promise<() => Promise<void>> {
    // we create the file because lockfile will fail if it doesn't exist
    await this.createEmptyStorageFile();
    return await lockfile.lock(this.getPathToStorage());
  }

  async readStorage(): Promise<AgentStorage> {
    const raw = await fs.readFile(this.getPathToStorage(), "utf8");
    if (raw === "") {
      return {
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
    const release = await this.lowLevelStorageService.lockStorage();
    try {
      return await fn(this.lowLevelStorageService);
    } finally {
      await release();
    }
  }
}
