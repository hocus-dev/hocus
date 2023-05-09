import type { Prisma } from "@prisma/client";
import yaml from "yaml";

import type { InitConfig } from "./init-config.validator.server";

export class InitService {
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
}
