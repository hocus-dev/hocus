import fs from "fs/promises";

import type { Prisma } from "@prisma/client";
import type { Logger } from "winston";
import yaml from "yaml";

import type { InitConfig } from "./init-config.validator.server";

import type { Config } from "~/config";
import { Token } from "~/token";
import { displayError, sleep } from "~/utils.shared";

export class InitService {
  static inject = [Token.Logger, Token.Config] as const;
  private readonly initConfig: ReturnType<Config["init"]>;

  constructor(private readonly logger: Logger, config: Config) {
    this.initConfig = config.init();
  }

  async getInitConfig(db: Prisma.Client): Promise<InitConfig> {
    const usersRaw = await db.user.findMany({
      include: {
        gitConfig: true,
        sshPublicKeys: true,
      },
    });
    usersRaw.sort((a, b) => a.externalId.localeCompare(b.externalId));

    const projectsRaw = await db.project.findMany({
      include: {
        environmentVariableSet: {
          include: {
            environmentVariables: true,
          },
        },
        gitRepository: {
          include: {
            sshKeyPair: true,
          },
        },
        UserProjectEnvironmentVariableSet: {
          include: {
            user: true,
            environmentSet: {
              include: {
                environmentVariables: true,
              },
            },
          },
        },
      },
    });
    projectsRaw.sort((a, b) => a.name.localeCompare(b.name));

    const reposRaw = Array.from(
      new Map(
        projectsRaw.map((project) => project.gitRepository).map((repo) => [repo.url, repo]),
      ).values(),
    ).sort((a, b) => a.url.localeCompare(b.url));

    const users = usersRaw.map((user) => ({
      externalId: user.externalId,
      git: {
        username: user.gitConfig.gitUsername,
        email: user.gitConfig.gitEmail,
      },
      publicKeys: user.sshPublicKeys
        .map((keyPair) => ({ publicKey: keyPair.publicKey, name: keyPair.name }))
        .sort((a, b) => a.publicKey.localeCompare(b.publicKey)),
    }));
    users.sort((a, b) => a.externalId.localeCompare(b.externalId));

    const repos = reposRaw.map((repo) => ({
      url: repo.url,
      publicKey: repo.sshKeyPair.publicKey,
      privateKey: repo.sshKeyPair.privateKey,
    }));
    const projects = projectsRaw.map((project) => ({
      name: project.name,
      externalId: project.externalId,
      repoUrl: project.gitRepository.url,
      rootDirectoryPath: project.rootDirectoryPath,
      env: {
        project: Object.fromEntries(
          project.environmentVariableSet.environmentVariables.map((vars) => [
            vars.name,
            vars.value,
          ]),
        ),
        user: Object.fromEntries(
          project.UserProjectEnvironmentVariableSet.map(({ user, environmentSet }) => [
            user.externalId,
            Object.fromEntries(
              environmentSet.environmentVariables.map((vars) => [vars.name, vars.value]),
            ),
          ]),
        ),
      },
      config: {
        maxPrebuildRamMib: project.maxPrebuildRamMib,
        maxPrebuildVCPUCount: project.maxPrebuildVCPUCount,
        maxWorkspaceRamMib: project.maxWorkspaceRamMib,
        maxWorkspaceVCPUCount: project.maxWorkspaceVCPUCount,
        maxWorkspaceProjectDriveSizeMib: project.maxWorkspaceProjectDriveSizeMib,
        maxWorkspaceRootDriveSizeMib: project.maxWorkspaceRootDriveSizeMib,
        maxPrebuildRootDriveSizeMib: project.maxPrebuildRootDriveSizeMib,
      },
    }));
    return {
      repos,
      users,
      projects,
    };
  }

  stringifyInitConfig(initConfig: InitConfig): string {
    return yaml.stringify(initConfig, { sortMapEntries: true, indent: 2 });
  }

  parseInitConfig(contents: string): InitConfig {
    return yaml.parse(contents);
  }

  async loadInitConfigFromFile(filePath: string): Promise<InitConfig> {
    const contents = await fs.readFile(filePath, "utf-8");
    return this.parseInitConfig(contents);
  }

  async dumpInitConfigToFile(filePath: string, initConfig: InitConfig): Promise<void> {
    const contents = this.stringifyInitConfig(initConfig);
    await fs.writeFile(filePath, contents);
  }

  async runDumpLoop(db: Prisma.Client): Promise<void> {
    if (!this.initConfig.configDumpEnabled) {
      return;
    }
    const interval = this.initConfig.configDumpIntervalSeconds * 1000;

    while (true) {
      try {
        const initConfig = await this.getInitConfig(db);
        await this.dumpInitConfigToFile(this.initConfig.configDumpPath, initConfig);
      } catch (err) {
        this.logger.error(displayError(err));
      }
      await sleep(interval);
    }
  }
}
