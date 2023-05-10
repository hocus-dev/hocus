import fs from "fs/promises";

import type { Prisma } from "@prisma/client";
import { SshKeyPairType } from "@prisma/client";
import type { Client } from "@temporalio/client";
import { v4 as uuidv4 } from "uuid";
import type { Logger } from "winston";
import yaml from "yaml";

import type { InitConfig } from "./init-config.validator.server";

import { runAddProjectAndRepository } from "~/agent/workflows";
import type { Config } from "~/config";
import type { SshKeyService } from "~/ssh-key/ssh-key.service";
import { MAIN_TEMPORAL_QUEUE } from "~/temporal/constants";
import { Token } from "~/token";
import { displayError, sleep, unwrap } from "~/utils.shared";

export class InitService {
  static inject = [Token.Logger, Token.Config, Token.SshKeyService] as const;
  private readonly initConfig: ReturnType<Config["init"]>;
  private temporalQueue = MAIN_TEMPORAL_QUEUE;

  constructor(
    private readonly logger: Logger,
    config: Config,
    private readonly sshKeyService: SshKeyService,
  ) {
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

  async createUsers(db: Prisma.Client, initConfig: InitConfig): Promise<void> {
    for (const userConfig of initConfig.users) {
      let user = await db.user.findUnique({
        where: {
          externalId: userConfig.externalId,
        },
      });
      const gitConfig = {
        gitUsername: userConfig.git.username,
        gitEmail: userConfig.git.email,
      };
      const publicKeys = userConfig.publicKeys.map((key) => ({
        name: key.name,
        publicKey: key.publicKey,
      }));
      if (user == null) {
        user = await db.user.create({
          data: {
            externalId: userConfig.externalId,
            active: true,
            gitConfig: {
              create: gitConfig,
            },
            sshPublicKeys: {
              create: publicKeys,
            },
          },
        });
      }
      await db.userGitConfig.update({
        where: {
          id: user.gitConfigId,
        },
        data: gitConfig,
      });
      for (const publicKey of publicKeys) {
        const existingKey = await db.userSSHPublicKey.findFirst({
          where: {
            userId: user.id,
            publicKey: publicKey.publicKey,
            name: publicKey.name,
          },
        });
        if (existingKey == null) {
          await db.userSSHPublicKey.create({
            data: {
              userId: user.id,
              publicKey: publicKey.publicKey,
              name: publicKey.name,
            },
          });
        }
      }
    }
  }

  async createProjectsAndRepos(
    db: Prisma.Client,
    temporalClient: Client,
    initConfig: InitConfig,
  ): Promise<void> {
    const publicKeyToKeyPairId = new Map<string, bigint>();
    const repoUrlToPublicKey = new Map<string, string>();
    for (const repo of initConfig.repos) {
      repoUrlToPublicKey.set(repo.url, repo.publicKey);
      if (publicKeyToKeyPairId.has(repo.publicKey)) {
        continue;
      }
      let keyPair = await db.sshKeyPair.findFirst({
        where: {
          publicKey: repo.publicKey,
        },
      });
      if (keyPair == null) {
        keyPair = await this.sshKeyService.createSshKeyPair(
          db,
          repo.privateKey,
          SshKeyPairType.SSH_KEY_PAIR_TYPE_SERVER_CONTROLLED,
        );
      }
      publicKeyToKeyPairId.set(repo.publicKey, keyPair.id);
    }
    for (const projectConfig of initConfig.projects) {
      let project = await db.project.findUnique({
        where: {
          externalId: projectConfig.externalId,
        },
      });
      if (project != null) {
        continue;
      }
      const repoPublicKey = unwrap(repoUrlToPublicKey.get(projectConfig.repoUrl));
      const keyPairId = unwrap(publicKeyToKeyPairId.get(repoPublicKey));
      const result = await temporalClient.workflow.execute(runAddProjectAndRepository, {
        workflowId: uuidv4(),
        taskQueue: this.temporalQueue,
        retry: { maximumAttempts: 1 },
        args: [
          {
            gitRepositoryUrl: projectConfig.repoUrl,
            sshKeyPairId: keyPairId,
            projectWorkspaceRoot: projectConfig.rootDirectoryPath,
            projectName: projectConfig.name,
            projectExternalId: projectConfig.externalId,
          },
        ],
      });
      project = result.project;
      await db.project.update({
        where: {
          id: project.id,
        },
        data: {
          ...projectConfig.config,
        },
      });
      for (const [userId, environmentVariables] of Object.entries(projectConfig.env.user)) {
        const user = await db.user.findUniqueOrThrow({
          where: {
            externalId: userId,
          },
        });
        const userSet = await db.userProjectEnvironmentVariableSet.upsert({
          // eslint-disable-next-line camelcase
          where: { userId_projectId: { userId: user.id, projectId: project.id } },
          create: {
            user: { connect: { id: user.id } },
            project: { connect: { id: project.id } },
            environmentSet: { create: {} },
          },
          update: {},
          include: {
            environmentSet: {
              include: { environmentVariables: true },
            },
          },
        });
        for (const [name, value] of Object.entries(environmentVariables)) {
          await db.environmentVariable.upsert({
            where: {
              // eslint-disable-next-line camelcase
              environmentVariableSetId_name: {
                name,
                environmentVariableSetId: userSet.environmentSetId,
              },
            },
            update: {
              value,
            },
            create: {
              name,
              value,
              environmentVariableSet: { connect: { id: userSet.environmentSetId } },
            },
          });
        }
      }
      for (const [name, value] of Object.entries(projectConfig.env.project)) {
        await db.environmentVariable.upsert({
          where: {
            // eslint-disable-next-line camelcase
            environmentVariableSetId_name: {
              name,
              environmentVariableSetId: project.environmentVariableSetId,
            },
          },
          update: {
            value,
          },
          create: {
            name,
            value,
            environmentVariableSet: { connect: { id: project.environmentVariableSetId } },
          },
        });
      }
    }
  }

  async loadConfig(db: Prisma.Client, client: Client, initConfig: InitConfig): Promise<void> {
    await this.createUsers(db, initConfig);
    await this.createProjectsAndRepos(db, client, initConfig);
  }
}
